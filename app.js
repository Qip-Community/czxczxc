import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAisrucwhJn-DUlsPKhB1sdf5tF3OfOVzA",
  authDomain: "fsfs-27fa1.firebaseapp.com",
  projectId: "fsfs-27fa1",
  storageBucket: "fsfs-27fa1.firebasestorage.app",
  messagingSenderId: "191715294559",
  appId: "1:191715294559:web:272608cd9c0f171c1bcaea",
  measurementId: "G-5BY3NFN2F8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const commentUnsubs = {};

onAuthStateChanged(auth, (user) => {
  const userHeader = document.getElementById('userHeader');
  const authNavBtn = document.getElementById('authNavBtn');
  const postCreateSection = document.getElementById('postCreateSection');

  if (user) {
    if (userHeader) {
      userHeader.classList.remove('hidden');
      document.getElementById('myAvatar').src = user.photoURL || 'https://via.placeholder.com/40';
      document.getElementById('myDisplayName').textContent = user.displayName || user.email;
    }
    if (authNavBtn) authNavBtn.classList.add('hidden');
    if (postCreateSection) postCreateSection.classList.remove('hidden');
  } else {
    if (userHeader) userHeader.classList.add('hidden');
    if (authNavBtn) authNavBtn.classList.remove('hidden');
    if (postCreateSection) postCreateSection.classList.add('hidden');
  }
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

export function renderFeed(targetUid = null, searchQuery = '') {
  const feed = document.getElementById('postsFeed');
  if (!feed) return;

  let q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  if (targetUid) {
    q = query(collection(db, "posts"), where("authorId", "==", targetUid), orderBy("createdAt", "desc"));
  }

  onSnapshot(q, (snapshot) => {
    feed.innerHTML = '';
    
    snapshot.forEach((docSnap) => {
      const post = docSnap.data();
      const id = docSnap.id;
      
      if (searchQuery && !post.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      const currentUser = auth.currentUser;
      const isLiked = currentUser && post.likes?.includes(currentUser.uid);
      const isOwner = currentUser && currentUser.uid === post.authorId;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="post-header">
          <div class="post-user-info">
            <img class="avatar" src="${post.authorAvatar || 'https://via.placeholder.com/40'}">
            <div>
              <a href="profile.html?uid=${post.authorId}" class="post-author">${escapeHtml(post.authorName || 'Пользователь')}</a>
              <div class="post-date">${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
            </div>
          </div>
          ${isOwner ? `<button class="btn-danger" style="padding:4px 8px; font-size:12px" id="del-${id}">Удалить</button>` : ''}
        </div>
        <div class="post-content">${escapeHtml(post.text || '')}</div>
        ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" class="post-img">` : ''}
        <div class="post-actions">
          <button class="btn-secondary" id="like-${id}">${isLiked ? '❤️ Не нравится' : '🤍 Нравится'} (${post.likes?.length || 0})</button>
        </div>
        <div class="comments-section">
          <div id="comments-${id}"></div>
          ${currentUser ? `
            <div style="display:flex; gap:6px; margin-top:10px;">
              <input type="text" id="input-comm-${id}" placeholder="Написать комментарий..." style="margin:0">
              <button id="btn-comm-${id}">Отправить</button>
            </div>
          ` : '<p style="font-size:12px; color:gray; margin-top:5px;">Войдите, чтобы комментировать</p>'}
        </div>
      `;

      feed.appendChild(card);

      document.getElementById(`like-${id}`).onclick = () => toggleLike(id, post.likes || []);
      
      if (isOwner) {
        document.getElementById(`del-${id}`).onclick = async () => {
          if (confirm("Удалить этот пост?")) {
            if (commentUnsubs[id]) commentUnsubs[id]();
            await deleteDoc(doc(db, "posts", id));
          }
        };
      }

      loadComments(id);

      const commBtn = document.getElementById(`btn-comm-${id}`);
      if (commBtn) {
        const sendComment = async () => {
          const input = document.getElementById(`input-comm-${id}`);
          const text = input.value.trim();
          if (!text) return;

          try {
            await addDoc(collection(db, "posts", id, "comments"), {
              author: currentUser.displayName || currentUser.email,
              authorId: currentUser.uid,
              text: text,
              createdAt: new Date()
            });
            input.value = '';
          } catch (e) {
            alert("Ошибка комментария: " + e.message);
          }
        };

        commBtn.onclick = sendComment;
        document.getElementById(`input-comm-${id}`).onkeypress = (e) => {
          if (e.key === 'Enter') sendComment();
        };
      }
    });
  });
}

function loadComments(postId) {
  const container = document.getElementById(`comments-${postId}`);
  if (!container) return;

  if (commentUnsubs[postId]) commentUnsubs[postId]();

  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));

  commentUnsubs[postId] = onSnapshot(q, (snapshot) => {
    container.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const c = docSnap.data();
      const div = document.createElement('div');
      div.className = 'comment';
      div.innerHTML = `<a href="profile.html?uid=${c.authorId}" class="comment-author">${escapeHtml(c.author)}:</a> ${escapeHtml(c.text)}`;
      container.appendChild(div);
    });
  });
}

async function toggleLike(postId, likes) {
  if (!auth.currentUser) return alert("Авторизуйтесь!");
  const ref = doc(db, "posts", postId);
  const uid = auth.currentUser.uid;

  if (likes.includes(uid)) {
    await updateDoc(ref, { likes: arrayRemove(uid) });
  } else {
    await updateDoc(ref, { likes: arrayUnion(uid) });
  }
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}