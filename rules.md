rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function ownerUid() {
      // Twoje stałe UID właściciela (Główny Admin)
      return "fIGFNjIUm6Onldwe27qb7R9vvB63";
    }

    function isOwner() {
      return isSignedIn() && request.auth.uid == ownerUid();
    }

    // --- GŁÓWNA STRUKTURA DANYCH APLIKACJI ---
    match /artifacts/{appId}/public/data/participants/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if isOwner();
    }

    // --- DANE PUBLICZNE (np. konfiguracja, stacje) ---
    // Zezwól na odczyt wszystkim zalogowanym
    match /artifacts/{appId}/public/data/config/{docId} {
      allow read: if isSignedIn();
      allow write: if isOwner();
    }
    match /artifacts/{appId}/public/data/stations/{docId} {
      allow read: if isSignedIn();
      allow write: if isOwner();
    }
  }
}
