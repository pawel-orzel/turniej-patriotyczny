rules_version = '2'; // Wersja reguł dla Firestore

service cloud.firestore {
  match /databases/{database}/documents {

    // ==========================================
    // 1. FUNKCJE POMOCNICZE
    // ==========================================
    function isSignedIn() {
      return request.auth != null;
    }

    function ownerUid() {
      // Twoje stałe UID właściciela (Główny Admin)
      // WAŻNE: Musi być identyczne jak OWNER_UID w pliku App.jsx
      return "Do8KU9DccNWoAMDxhARxZj8zref1";
    }

    function isOwner() {
      return isSignedIn() && request.auth.uid == ownerUid();
    }
    
    // ==========================================
    // 2. GŁÓWNA STRUKTURA DANYCH APLIKACJI
    // ==========================================
    match /artifacts/{appId} {
      
      match /public/data {

        // --- APLIKACJA: TURNIEJ 2.0 ---
        
        // Konfiguracja (Czas zakończenia, ogłoszenia, stan Reżyserki na żywo dla finału)
        match /config/{document=**} {
          allow read: if true; 
          allow write: if isOwner();
        }

        // Obsługuje kolekcję uczestników i punktację (Ranking musi być w pełni odczytywalny)
        match /participants/{participantId} {
          allow read: if true;
          allow create: if isSignedIn() && request.auth.uid == participantId;
          allow update: if isSignedIn() && (request.auth.uid == participantId || isOwner());
          allow delete: if isSignedIn() && isOwner();
        }

        // Wyniki finałowe poszczególnych pytań (szybkość, poprawność)
        match /stageResults/{resultId} {
          allow read: if true;
          allow write: if isOwner() || (isSignedIn() && request.resource.data.uid == request.auth.uid);
        }
      }
    }

    // Zabezpieczenie wszystkiego innego
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
