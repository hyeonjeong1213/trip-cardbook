
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ===================================
// 1. API 및 Firebase 설정
// ===================================

// 공공데이터포털 일반 인증키(Decoding)
const TOUR_API_KEY = "여기에_공공데이터_API_인증키";

// Firebase 설정
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===================================
// 2. 전역 변수
// ===================================

let currentUser = null;
let tourData = [];
let favoriteIds = new Set();

const API_URL =
    "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";

// ===================================
// 3. HTML 요소 가져오기
// ===================================

const areaSelect = document.getElementById("areaSelect");
const searchBtn = document.getElementById("searchBtn");

const tourList = document.getElementById("tourList");
const favoriteList = document.getElementById("favoriteList");

const loading = document.getElementById("loading");
const emptyMessage = document.getElementById("emptyMessage");
const favoriteEmpty = document.getElementById("favoriteEmpty");

const resultCount = document.getElementById("resultCount");
const favoriteCount = document.getElementById("favoriteCount");

const homeTab = document.getElementById("homeTab");
const favoriteTab = document.getElementById("favoriteTab");

const searchSection = document.getElementById("searchSection");
const listSection = document.getElementById("listSection");
const favoriteSection = document.getElementById("favoriteSection");

// ===================================
// 4. Firebase 익명 로그인
// ===================================

async function initFirebase() {

    try {

        const userCredential = await signInAnonymously(auth);

        currentUser = userCredential.user;

        console.log("로그인 성공:", currentUser.uid);

        await loadFavoriteIds();

    } catch (error) {

        console.error("Firebase 로그인 실패:", error);

        alert("Firebase 연결에 실패했습니다. 설정을 확인해 주세요.");

        throw error;
    }
}

// ===================================
// 5. 사용자별 찜 목록 경로
// ===================================

function getFavoriteCollection() {

    return collection(
        db,
        "users",
        currentUser.uid,
        "favorites"
    );
}

// ===================================
// 6. 관광정보 API 호출
// ===================================

async function searchTourList(areaCode) {

    if (!areaCode) {
        alert("지역을 선택해 주세요.");
        return;
    }

    loading.classList.remove("hidden");
    emptyMessage.classList.add("hidden");

    tourList.innerHTML = "";
    resultCount.textContent = "관광정보를 불러오는 중입니다.";

    try {

        const params = new URLSearchParams({
            serviceKey: TOUR_API_KEY,
            numOfRows: "12",
            pageNo: "1",
            MobileOS: "ETC",
            MobileApp: "TripCardBook",
            areaCode: areaCode,
            contentTypeId: "12",
            arrange: "Q",
            _type: "json"
        });

        const response = await fetch(
            `${API_URL}?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error("API 서버 응답 오류");
        }

        const data = await response.json();

        const items = data.response?.body?.items?.item;

        if (!items) {
            tourData = [];
            renderTourList();
            return;
        }

        tourData = Array.isArray(items) ? items : [items];

        renderTourList();

    } catch (error) {

        console.error("관광정보 조회 실패:", error);

        alert(
            "관광정보를 불러오지 못했습니다.\n" +
            "API 인증키와 네트워크 연결을 확인해 주세요."
        );

    } finally {

        loading.classList.add("hidden");

    }
}

// ===================================
// 7. 관광지 목록 출력
// ===================================

function renderTourList() {

    tourList.innerHTML = "";

    resultCount.textContent =
        `총 ${tourData.length}개의 관광정보`;

    if (tourData.length === 0) {

        emptyMessage.classList.remove("hidden");
        return;

    }

    emptyMessage.classList.add("hidden");

    tourData.forEach(tour => {

        const isSaved = favoriteIds.has(String(tour.contentid));

        const card = document.createElement("article");

        card.className = "tour-card";

        const image = document.createElement("img");

        image.src = tour.firstimage || tour.firstimage2 ||
            "https://placehold.co/600x400?text=No+Image";

        image.alt = tour.title || "관광지 이미지";
        image.loading = "lazy";

        image.onerror = () => {
            image.src =
                "https://placehold.co/600x400?text=No+Image";
        };

        const info = document.createElement("div");
        info.className = "tour-info";

        const title = document.createElement("h4");
        title.textContent = tour.title || "이름 없음";

        const address = document.createElement("p");
        address.textContent = tour.addr1 || "주소 정보 없음";

        const footer = document.createElement("div");
        footer.className = "tour-footer";

        const type = document.createElement("span");
        type.textContent = "관광지";

        const button = document.createElement("button");

        button.className =
            isSaved ? "favorite-btn saved" : "favorite-btn";

        button.textContent =
            isSaved ? "♥ 찜 취소" : "♡ 찜하기";

        button.addEventListener("click", async () => {

            await toggleFavorite(tour);

        });

        footer.append(type, button);

        info.append(title, address, footer);

        card.append(image, info);

        tourList.appendChild(card);

    });

}

// ===================================
// 8. 찜 목록 ID 불러오기
// ===================================

async function loadFavoriteIds() {

    const snapshot = await getDocs(getFavoriteCollection());

    favoriteIds = new Set(
        snapshot.docs.map(doc => doc.id)
    );

}

// ===================================
// 9. 찜하기 / 찜 취소하기
// ===================================

async function toggleFavorite(tour) {

    const contentId = String(tour.contentid);

    const favoriteRef = doc(
        db,
        "users",
        currentUser.uid,
        "favorites",
        contentId
    );

    try {

        if (favoriteIds.has(contentId)) {

            // 찜 취소
            await deleteDoc(favoriteRef);

            favoriteIds.delete(contentId);

            alert("찜 목록에서 삭제했습니다.");

        } else {

            // 찜하기
            await setDoc(favoriteRef, {

                contentid: contentId,

                title: tour.title || "",

                addr1: tour.addr1 || "",

                firstimage:
                    tour.firstimage || tour.firstimage2 || "",

                areaCode: String(tour.areaCode || areaSelect.value),

                createdAt: serverTimestamp()

            });

            favoriteIds.add(contentId);

            alert("관광지를 찜 목록에 추가했습니다.");

        }

        renderTourList();

        if (!favoriteSection.classList.contains("hidden")) {

            await loadFavorites();

        }

    } catch (error) {

        console.error("찜 기능 오류:", error);

        alert("찜 목록 저장에 실패했습니다.");

    }

}

// ===================================
// 10. 찜한 관광지 조회
// ===================================

async function loadFavorites() {

    favoriteList.innerHTML = "";

    favoriteEmpty.classList.add("hidden");

    try {

        const snapshot = await getDocs(
            getFavoriteCollection()
        );

        const favorites = snapshot.docs.map(item => ({
            ...item.data(),
            contentid: item.id
        }));

        favoriteIds = new Set(
            favorites.map(item => item.contentid)
        );

        favoriteCount.textContent =
            `총 ${favorites.length}개의 여행지를 찜했습니다.`;

        if (favorites.length === 0) {

            favoriteEmpty.classList.remove("hidden");
            return;

        }

        favorites.forEach(tour => {

            const card = document.createElement("article");

            card.className = "tour-card";

            const image = document.createElement("img");

            image.src = tour.firstimage ||
                "https://placehold.co/600x400?text=No+Image";

            image.alt = tour.title || "관광지 이미지";

            image.onerror = () => {
                image.src =
                    "https://placehold.co/600x400?text=No+Image";
            };

            const info = document.createElement("div");

            info.className = "tour-info";

            const title = document.createElement("h4");

            title.textContent = tour.title || "이름 없음";

            const address = document.createElement("p");

            address.textContent = tour.addr1 || "주소 정보 없음";

            const footer = document.createElement("div");

            footer.className = "tour-footer";

            const label = document.createElement("span");

            label.textContent = "♥ 보관 중";

            const button = document.createElement("button");

            button.className = "favorite-btn saved";

            button.textContent = "찜 취소";

            button.addEventListener("click", async () => {

                await toggleFavorite(tour);

            });

            footer.append(label, button);

            info.append(title, address, footer);

            card.append(image, info);

            favoriteList.appendChild(card);

        });

    } catch (error) {

        console.error("보관함 조회 실패:", error);

        alert("보관함을 불러오지 못했습니다.");

    }

}

// ===================================
// 11. 탭 전환
// ===================================

function showHome() {

    searchSection.classList.remove("hidden");

    listSection.classList.remove("hidden");

    favoriteSection.classList.add("hidden");

    homeTab.classList.add("active");

    favoriteTab.classList.remove("active");

}

async function showFavorites() {

    searchSection.classList.add("hidden");

    listSection.classList.add("hidden");

    favoriteSection.classList.remove("hidden");

    homeTab.classList.remove("active");

    favoriteTab.classList.add("active");

    await loadFavorites();

}

// ===================================
// 12. 이벤트 등록
// ===================================

searchBtn.addEventListener("click", async () => {

    await searchTourList(areaSelect.value);

});

homeTab.addEventListener("click", showHome);

favoriteTab.addEventListener("click", showFavorites);

// ===================================
// 13. 프로그램 시작
// ===================================

async function startApp() {

    await initFirebase();

    console.log("TRIP CARDBOOK 시작 완료");

}

startApp();
