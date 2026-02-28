// -------------------------------
// Firebase 初始化
// -------------------------------
// 使用官方 CDN 的 ESM 版本 SDK（无需打包工具）
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

import { firebaseConfig } from "./config.js";

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// -------------------------------
// DOM 元素引用
// -------------------------------
const titleInput = document.querySelector(".editor__title");
const contentInput = document.querySelector(".editor__content");
const saveButton = document.querySelector(".editor__save");
const deleteButton = document.querySelector(".editor__delete");
const notesList = document.querySelector(".notes");
const previewTitle = document.querySelector(".preview__title");
const previewHint = document.querySelector(".preview__hint");
const editorStatus = document.querySelector(".editor__status");

// 当前选中的笔记 id
let currentNoteId = null;
let currentUser = null;

// -------------------------------
// 顶部登录区域（DOM）
// -------------------------------
const authEmailInput = document.querySelector(".auth__input--email");
const authPasswordInput = document.querySelector(".auth__input--password");
const authLoginBtn = document.querySelector(".auth__btn--login");
const authRegisterBtn = document.querySelector(".auth__btn--register");
const authLogoutBtn = document.querySelector(".auth__btn--logout");
const authStatusSpan = document.querySelector(".auth__status");

// 左侧新建按钮
const newNoteButton = document.querySelector(".sidebar__new");

// 右侧导入按钮
const importButton = document.querySelector(".editor__import");

// -------------------------------
// 简单预览联动（纯前端，不依赖后端）
// -------------------------------
function bindLivePreview() {
  if (!titleInput || !contentInput || !previewTitle || !previewHint) return;

  titleInput.addEventListener("input", () => {
    previewTitle.textContent = titleInput.value.trim() || "预览区域";
  });

  contentInput.addEventListener("input", () => {
    const text = contentInput.value.trim();
    previewHint.textContent = text || "这里可以显示当前选中的笔记内容，或把左侧选中的笔记加载出来。";
  });
}

// -------------------------------
// 登录/注册（真实 UI 版）
// -------------------------------
function formatFirebaseError(e) {
  if (!e) return "未知错误";
  const code = e.code ? String(e.code) : "";
  const msg = e.message ? String(e.message) : String(e);
  return code ? `${code}\n${msg}` : msg;
}

function setEditorStatus(message) {
  if (editorStatus) {
    editorStatus.textContent = message || "";
  }
}

async function ensureSignedIn() {
  if (currentUser) return currentUser;

  alert("请先在右上角输入邮箱和密码登录。");
  throw new Error("not-signed-in");
}

async function handleLogin() {
  const email = authEmailInput?.value?.trim() || "";
  const password = authPasswordInput?.value || "";
  if (!email || !password) {
    alert("请先输入邮箱和密码。");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error("登录失败", e);
    alert(`登录失败：\n${formatFirebaseError(e)}`);
  }
}

async function handleRegister() {
  const email = authEmailInput?.value?.trim() || "";
  const password = authPasswordInput?.value || "";
  if (!email || !password) {
    alert("请先输入邮箱和密码。");
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("注册成功，已自动登录。");
  } catch (e) {
    console.error("注册失败", e);
    alert(`注册失败：\n${formatFirebaseError(e)}`);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("退出失败", e);
    alert(`退出失败：\n${formatFirebaseError(e)}`);
  }
}

function syncAuthUI(user) {
  const loggedIn = Boolean(user);

  if (authEmailInput) authEmailInput.hidden = loggedIn;
  if (authPasswordInput) authPasswordInput.hidden = loggedIn;
  if (authLoginBtn) authLoginBtn.hidden = loggedIn;
  if (authRegisterBtn) authRegisterBtn.hidden = loggedIn;
  if (authLogoutBtn) authLogoutBtn.hidden = !loggedIn;

  if (authStatusSpan) {
    authStatusSpan.textContent = loggedIn ? `已登录：${user.email || user.uid}` : "未登录";
  }
}

function renderNotesMessage(message) {
  if (!notesList) return;
  notesList.innerHTML = "";
  const li = document.createElement("li");
  li.className = "notes__item";
  const btn = document.createElement("button");
  btn.className = "notes__button";
  btn.type = "button";
  btn.style.cursor = "default";
  btn.innerHTML = `<div class="notes__meta">${message}</div>`;
  li.appendChild(btn);
  notesList.appendChild(li);
}

// -------------------------------
// Firestore：笔记的增删改查
// -------------------------------
function notesCollection(userId) {
  return collection(db, "notes");
}

async function createNote(user, title, content, extra = {}) {
  const docRef = await addDoc(notesCollection(user.uid), {
    title: title || "未命名笔记",
    content: content || "",
    userId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
  return docRef.id;
}

// 监听当前用户的笔记列表变化，实时刷新左侧列表
function subscribeNotes(userId) {
  if (!notesList) return;

  const q = query(
    notesCollection(userId),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      notesList.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement("li");
        li.className = "notes__item";
        const btn = document.createElement("button");
        btn.className = "notes__button";
        btn.type = "button";
        btn.innerHTML = `
          <div class="notes__title">${data.title || "未命名笔记"}</div>
          <div class="notes__meta">${data.updatedAt?.toDate?.().toLocaleString?.() || ""}</div>
        `;
        btn.addEventListener("click", () => {
          currentNoteId = docSnap.id;
          titleInput.value = data.title || "";
          contentInput.value = data.content || "";
          previewTitle.textContent = data.title || "预览区域";
          previewHint.textContent =
            data.content || "这里可以显示当前选中的笔记内容，或把左侧选中的笔记加载出来。";
        });
        li.appendChild(btn);
        notesList.appendChild(li);
      });
    },
    (error) => {
      console.error("订阅笔记列表失败", error);
      alert(`读取笔记列表失败：\n${formatFirebaseError(error)}\n\n（如果提示需要创建索引，按提示点链接创建即可）`);
    },
  );
}

let unsubscribeNotes = null;

// -------------------------------
// 保存 / 删除按钮绑定
// -------------------------------
async function handleSave() {
  try {
    const user = await ensureSignedIn();
    const title = titleInput.value.trim() || "未命名笔记";
    const content = contentInput.value;

    if (!title && !content) {
      alert("笔记内容为空，不需要保存。");
      return;
    }

    const base = {
      title,
      content,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    if (!currentNoteId) {
      await addDoc(notesCollection(user.uid), {
        ...base,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, "notes", currentNoteId),
        base,
        { merge: true },
      );
    }

    setEditorStatus("已保存到云端。");
  } catch (e) {
    if (e.message === "not-signed-in") return;
    console.error("保存失败", e);
    alert(`保存失败：\n${formatFirebaseError(e)}`);
  }
}

async function handleDelete() {
  if (!currentNoteId) {
    alert("当前没有选中的笔记。");
    return;
  }
  if (!confirm("确定要删除这条笔记吗？")) return;

  try {
    const user = await ensureSignedIn();
    await deleteDoc(doc(db, "notes", currentNoteId));
    currentNoteId = null;
    titleInput.value = "";
    contentInput.value = "";
    previewTitle.textContent = "预览区域";
    previewHint.textContent = "这里可以显示当前选中的笔记内容，或把左侧选中的笔记加载出来。";
  } catch (e) {
    if (e.message === "not-signed-in") return;
    console.error("删除失败", e);
    alert(`删除失败：\n${formatFirebaseError(e)}`);
  }
}

// -------------------------------
// 新建 / 导入
// -------------------------------
function resetEditorToNewNote() {
  currentNoteId = null;
  if (titleInput) titleInput.value = "";
  if (contentInput) contentInput.value = "";
  if (previewTitle) previewTitle.textContent = "预览区域";
  if (previewHint)
    previewHint.textContent = "这里可以显示当前选中的笔记内容，或把左侧选中的笔记加载出来。";
}

const importFileInput = document.createElement("input");
importFileInput.type = "file";
importFileInput.accept = ".md,.markdown,.txt,text/markdown,text/plain";
importFileInput.hidden = true;
document.body.appendChild(importFileInput);

function guessTitleFromMarkdownOrName(filename, text) {
  const heading = text.match(/^\s*#\s+(.+)\s*$/m);
  if (heading && heading[1]) return heading[1].trim();
  const name = (filename || "").replace(/\.[^/.]+$/, "").trim();
  return name || "导入的笔记";
}

async function handleImportClick() {
  try {
    await ensureSignedIn();
    importFileInput.value = "";
    importFileInput.click();
  } catch {
    // ensureSignedIn 已经提示过了
  }
}

async function handleImportSelectedFile(file) {
  if (!file) return;

  const user = await ensureSignedIn();

  const isText =
    file.type.startsWith("text/") || /\.(md|markdown|txt)$/i.test(file.name || "");

  if (isText) {
    // 文本/Markdown：直接作为正文导入
    const text = await file.text();
    const title = guessTitleFromMarkdownOrName(file.name, text);
    const newId = await createNote(user, title, text, {
      fileName: file.name,
      fileType: file.type || "text/plain",
      importedFromFile: true,
    });
    currentNoteId = newId;
    if (titleInput) titleInput.value = title;
    if (contentInput) contentInput.value = text;
    if (previewTitle) previewTitle.textContent = title || "预览区域";
    if (previewHint) previewHint.textContent = text || "";
    setEditorStatus("已导入 Markdown/文本笔记并保存到云端。");
    return;
  }

  // 其他类型（PDF/Word/图片等）：上传到 Storage，笔记正文里给出说明和链接
  const filePath = `uploads/${user.uid}/${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  const title = file.name.replace(/\.[^/.]+$/, "") || "导入的文件";
  const content = `已导入文件：${file.name}\n\n下载链接：${url}\n\n（如需解析 PDF/Word/图片内容，可在后续升级中完成。）`;

  const newId = await createNote(user, title, content, {
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileUrl: url,
    importedFromFile: true,
  });

  currentNoteId = newId;
  if (titleInput) titleInput.value = title;
  if (contentInput) contentInput.value = content;
  if (previewTitle) previewTitle.textContent = title || "预览区域";
  if (previewHint) previewHint.textContent = content || "";
  setEditorStatus("已导入文件并上传到云端。");
}

// -------------------------------
// 启动逻辑
// -------------------------------
bindLivePreview();

if (saveButton) {
  saveButton.addEventListener("click", handleSave);
}

if (deleteButton) {
  deleteButton.addEventListener("click", handleDelete);
}

if (newNoteButton) {
  newNoteButton.addEventListener("click", resetEditorToNewNote);
}

if (importButton) {
  importButton.addEventListener("click", handleImportClick);
}

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  try {
    await handleImportSelectedFile(file);
  } catch (e) {
    console.error("导入失败", e);
    alert(`导入失败：\n${formatFirebaseError(e)}`);
  }
});

if (authLoginBtn) authLoginBtn.addEventListener("click", handleLogin);
if (authRegisterBtn) authRegisterBtn.addEventListener("click", handleRegister);
if (authLogoutBtn) authLogoutBtn.addEventListener("click", handleLogout);
if (authPasswordInput) {
  authPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
}

// 当检测到登录状态为已登录时，订阅笔记列表
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  syncAuthUI(currentUser);

  if (unsubscribeNotes) {
    unsubscribeNotes();
    unsubscribeNotes = null;
  }

  if (user) {
    unsubscribeNotes = subscribeNotes(user.uid);
  } else {
    renderNotesMessage("请先登录以加载你的云端笔记...");
    resetEditorToNewNote();
  }
});

