// Ganti dengan konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyDfdWsO1H11PjSY7IecaX_QICc14yLOtpQ",
  authDomain: "xbibzstorage.firebaseapp.com",
  databaseURL: "https://xbibzstorage-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xbibzstorage",
  storageBucket: "xbibzstorage.firebasestorage.app",
  messagingSenderId: "288109423771",
  appId: "1:288109423771:web:6303592da70243b7016a3e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();