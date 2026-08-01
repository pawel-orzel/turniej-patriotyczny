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
    // Dopasowanie do kolekcji 'artifacts'
    match /artifacts/{appId}/public/data/{collection}/{docId} {

      // Każdy zalogowany użytkownik może czytać dane publiczne (ranking, konfiguracja)
      allow read: if isSignedIn();

      // Logika dla kolekcji uczestników (participants)
      match /participants/{userId} {
        // Zezwól użytkownikowi na tworzenie, odczyt i aktualizację WŁASNEGO dokumentu.
        // To jest kluczowa reguła, która pozwoli nowym graczom na rejestrację.
        allow create, read, update: if isSignedIn() && request.auth.uid == userId;

        // Zezwól właścicielowi aplikacji na pełny dostęp (zapis, usuwanie).
        allow write, delete: if isOwner();
      }

      // Zezwól właścicielowi na pełny dostęp do konfiguracji i innych kolekcji
      allow write: if isOwner();
    }
  }
}
