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
      // UID właściciela jest teraz przechowywane w dokumencie, a nie w kodzie.
      return get(/databases/$(database)/documents/artifacts/$(request.path[2])/internal/owner).data.uid;
    }

    function isOwner() {
      // Sprawdź, czy dokument właściciela istnieje, zanim spróbujesz go odczytać.
      return exists(/databases/$(database)/documents/artifacts/$(request.path[2])/internal/owner) && isSignedIn() && request.auth.uid == ownerUid();
    }
    
    // ==========================================
    // 2. GŁÓWNA STRUKTURA DANYCH APLIKACJI
    // ==========================================
    match /artifacts/{appId} {

      // --- KOLEKCJA WEWNĘTRZNA (np. do przechowywania UID admina) ---
      match /internal/{document=**} {
        // Każdy zalogowany może odczytać, kto jest właścicielem.
        allow read: if isSignedIn();
        // Zapis jest dozwolony tylko wtedy, gdy dokument właściciela jeszcze nie istnieje (jednorazowe ustawienie).
        // Lub gdy obecny właściciel chce coś zmienić (choć obecnie nie ma takiej potrzeby).
        allow write: if isSignedIn() && (!exists(path) || isOwner());
      }
      
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

        // --- PRZYKŁADOWA NOWA KOLEKCJA: DRUŻYNY ---
        match /teams/{teamId} {
          // Każdy może odczytać dane drużyny.
          allow read: if true;

          // Tylko zalogowany użytkownik może stworzyć drużynę,
          // pod warunkiem, że jest jej właścicielem (creatorUid).
          // Sprawdzamy, czy pole `creatorUid` w nowym dokumencie zgadza się z UID zalogowanego użytkownika.
          allow create: if isSignedIn() && request.resource.data.creatorUid == request.auth.uid;

          // Tylko twórca drużyny lub główny admin może ją edytować lub usunąć.
          allow update, delete: if isSignedIn() && (resource.data.creatorUid == request.auth.uid || isOwner());
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
