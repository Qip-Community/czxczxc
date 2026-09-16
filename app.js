import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile 
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

// Глобальное отслеживание пользователя
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

// Выход
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

// Загрузка ленты
export function renderFeed(targetUid = null) {
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
      const currentUser = auth.currentUser;
      const isLiked = currentUser && post.likes?.includes(currentUser.uid);
      const isOwner = currentUser && currentUser.uid === post.authorId;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="post-header">
          <div class="post-user-info">
            <img class="avatar" src="${post.authorAvatar}">
            <div>
              <a href="profile.html?uid=${post.authorId}" class="post-author">${post.authorName}</a>
              <div class="post-date">${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
            </div>
          </div>
          ${isOwner ? `<button class="btn-danger" style="padding:4px 8px; font-size:12px" id="del-${id}">Удалить</button>` : ''}
        </div>
        <div class="post-content">${escapeHtml(post.text)}</div>
        ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-img">` : ''}
        <div class="post-actions">
          <button class="btn-secondary" id="like-${id}">${isLiked ? '❤️ UnLike' : '🤍 Like'} (${post.likes?.length || 0})</button>
        </div>
        <div class="comments-section">
          <div id="comments-${id}"></div>
          ${currentUser ? `
            <div style="display:flex; gap:5px; margin-top:8px;">
              <input type="text" id="input-comm-${id}" placeholder="Написать комментарий..." style="margin:0">
              <button id="btn-comm-${id}">></button>
            </div>
          ` : ''}
        </div>
      `;

      feed.appendChild(card);

      // Лайки
      document.getElementById(`like-${id}`).onclick = () => toggleLike(id, post.likes || []);
      
      // Удаление
      if (isOwner) {
        document.getElementById(`del-${id}`).onclick = async () => {
          if (confirm("Удалить пост?")) await deleteDoc(doc(db, "posts", id));
        };
      }

      // Комментарии
      const commentsContainer = document.getElementById(`comments-${id}`);
      (post.comments || []).forEach(c => {
        const cEl = document.createElement('div');
        cEl.className = 'comment';
        cEl.innerHTML = `<span class="comment-author">${c.author}:</span>${escapeHtml(c.text)}`;
        commentsContainer.appendChild(cEl);
      });

      const commBtn = document.getElementById(`btn-comm-${id}`);
      if (commBtn) {
        commBtn.onclick = async () => {
          const input = document.getElementById(`input-comm-${id}`);
          if (!input.value.trim()) return;
          await updateDoc(doc(db, "posts", id), {
            comments: arrayUnion({ author: currentUser.displayName || currentUser.email, text: input.value.trim() })
          });
          input.value = '';
        };
      }
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