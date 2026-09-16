import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove, 
  where 
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

// Хранилище активных слушателей подколлекций для предотвращения дублирования
const activeCommentListeners = {};

// Глобальное отслеживание состояния авторизации
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

// Выход из аккаунта
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

// Рендеринг ленты с подгрузкой комментариев из Firestore
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
            <img class="avatar" src="${post.authorAvatar || 'https://via.placeholder.com/40'}">
            <div>
              <a href="profile.html?uid=${post.authorId}" class="post-author">${post.authorName || 'Пользователь'}</a>
              <div class="post-date">${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
            </div>
          </div>
          ${isOwner ? `<button class="btn-danger" style="padding:4px 8px; font-size:12px" id="del-${id}">Удалить</button>` : ''}
        </div>
        <div class="post-content">${escapeHtml(post.text || '')}</div>
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
          ` : '<p style="font-size:12px; color:gray; margin-top:5px;">Войдите, чтобы комментировать</p>'}
        </div>
      `;

      feed.appendChild(card);

      // Обработка Лайков
      document.getElementById(`like-${id}`).onclick = () => toggleLike(id, post.likes || []);
      
      // Обработка Удаления поста
      if (isOwner) {
        document.getElementById(`del-${id}`).onclick = async () => {
          if (confirm("Удалить пост?")) {
            if (activeCommentListeners[id]) activeCommentListeners[id]();
            await deleteDoc(doc(db, "posts", id));
          }
        };
      }

      // Отслеживание и сохранение комментариев в Firestore (в реальном времени)
      listenToComments(id);

      // Добавление нового комментария
      const commBtn = document.getElementById(`btn-comm-${id}`);
      if (commBtn) {
        commBtn.onclick = () => addComment(id);
        document.getElementById(`input-comm-${id}`).onkeypress = (e) => {
          if (e.key === 'Enter') addComment(id);
        };
      }
    });
  });
}

// Отдельная функция слушателя комментариев (сохраняет базу навсегда)
function listenToComments(postId) {
  const commentsContainer = document.getElementById(`comments-${postId}`);
  if (!commentsContainer) return;

  // Отписываемся от старого слушателя, если он был
  if (activeCommentListeners[postId]) {
    activeCommentListeners[postId]();
  }

  const commentsQuery = query(
    collection(db, "posts", postId, "comments"), 
    orderBy("createdAt", "asc")
  );

  activeCommentListeners[postId] = onSnapshot(commentsQuery, (snapshot) => {
    commentsContainer.innerHTML = '';
    snapshot.forEach((commDoc) => {
      const c = commDoc.data();
      const cEl = document.createElement('div');
      cEl.className = 'comment';
      cEl.innerHTML = `<span class="comment-author">${escapeHtml(c.author)}:</span>${escapeHtml(c.text)}`;
      commentsContainer.appendChild(cEl);
    });
  });
}

// Запись комментария в подколлекцию Firestore
async function addComment(postId) {
  const currentUser = auth.currentUser;
  if (!currentUser) return alert("Авторизуйтесь!");

  const input = document.getElementById(`input-comm-${postId}`);
  const text = input.value.trim();
  if (!text) return;

  try {
    await addDoc(collection(db, "posts", postId, "comments"), {
      author: currentUser.displayName || currentUser.email,
      authorId: currentUser.uid,
      text: text,
      createdAt: new Date()
    });
    input.value = '';
  } catch (err) {
    alert("Ошибка отправки комментария: " + err.message);
  }
}

// Переключение лайков
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

// Экранирование тегов для безопасности
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}