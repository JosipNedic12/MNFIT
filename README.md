# MNFIT – Gym Booking App

MNFIT je web aplikacija za vođenje termina u teretani, s ulogama korisnika, rezervacijama, administracijom i tjednim generiranjem termina.

---

## 📋 Sadržaj

- [Tehnologije](#tehnologije)
- [Funkcionalnosti](#funkcionalnosti)
- [Struktura projekta](#struktura-projekta)
- [Backend](#backend)
- [Frontend](#frontend)
- [Pokretanje projekta](#pokretanje-projekta)
- [Korisničke uloge](#korisničke-uloge)
- [API pregled](#api-pregled)
- [i18n i tema](#i18n-i-tema)
- [Napomene](#napomene)

---

## 🚀 Tehnologije

### Backend
- Node.js, Express 5
- MongoDB + Mongoose
- express-session + connect-mongo (session-based auth)
- bcryptjs (password hashing)
- node-cron (automatizirani cleanup)

### Frontend
- Angular 21 (standalone components)
- RxJS
- Bootstrap 5.3.3, Font Awesome 6.7.2
- Angular i18n (hr/en), `@angular/localize`
- Light/Dark tema (custom Theme servis)

---

## ✨ Funkcionalnosti

- ✅ Registracija i prijava korisnika (session, HTTP-only cookie)
- ✅ Različite **uloge**: `member`, `subscriber`, `trainer`, `admin`
- ✅ Pregled dostupnih termina grupiranih po danima
- ✅ Rezervacija termina (join/leave) s ograničenjem: **maksimalno 3 aktivna termina tjedno po korisniku**
- ✅ Pregled vlastitih rezervacija (My bookings) i otkazivanje
- ✅ Upravljanje terminima:
  - Kreiranje, uređivanje, brisanje (admin/trainer)
  - Automatsko postavljanje statusa `finished` kada termin započne
- ✅ Admin panel:
  - Pregled svih korisnika
  - Promjena uloga korisnicima
- ✅ Generiranje termina za cijeli tjedan prema predefiniranim slotovima
- ✅ Periodični cron job: brisanje `finished` termina starijih od 7 dana

---

## 📁 Struktura projekta
- server/
- ├── index.js
- ├── package.json
- └── src/
- ├── middleware/
- │ ├── auth.js
- │ ├── softAuth.js
- │ └── requireRole.js
- ├── models/
- │ ├── User.js
- │ ├── Term.js
- │ └── Booking.js
- └── routes/
- ├── auth.routes.js
- ├── terms.routes.js
- ├── bookings.routes.js
- └── admin.routes.js

- client/
- ├── angular.json
- ├── package.json
- └── src/
- ├── main.ts
- ├── index.html
- └── app/
- ├── app.ts
- ├── app.config.ts
- ├── app.routes.ts
- ├── auth.service.ts
- ├── terms.service.ts
- ├── booking.service.ts
- ├── admin.service.ts
- ├── theme.ts
- ├── guards/
- │ ├── auth.guard.ts
- │ └── admin.guard.ts
- ├── components/
- │ ├── app-navbar.component.ts
- │ ├── term-card.component.ts
- │ ├── term-details-modal.component.ts
- │ ├── term-create-modal.component.ts
- │ └── generate-week-modal.component.ts
- ├── pages/
- │ ├── home.page.ts
- │ ├── login.page.ts
- │ ├── register.page.ts
- │ ├── my-bookings.page.ts
- │ ├── terms.page.ts
- │ └── admin.page.ts
- ├── assets/
- │ └── images/
- │ └── logobg.png
- └── i18n/
- ├── messages.xlf
- └── messages.hr.xlf

---

## ⚙️ Backend

### Konfiguracija

Backend koristi environment varijable (npr. preko `.env`):

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/mnfit
SESSION_SECRET=some-long-secret
CLIENT_ORIGIN=http://localhost:4200
```
## ⚙️ Pokretanje

### Backend
```
cd server
npm install
npm run dev   # development (nodemon)
# ili
npm start     # production
```
Server se diže na http://localhost:3001.

### Frontend
```
cd client
npm install
npm start      # ng serve (dev)
```
Aplikacija se otvara na http://localhost:4200.

### Kompletno pokretanje (korak po korak)

#### 1. Pokreni MongoDB
Lokalni ili preko URI-ja:

mongod

#### 2. Postavi .env u server/ direktoriju
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/mnfit
SESSION_SECRET=some-long-secret
CLIENT_ORIGIN=http://localhost:4200
```
#### 3. Pokreni backend
```
cd server
npm install
npm run dev
```
#### 4. Pokreni frontend (u novom terminalu)
```
cd client
npm install
npm start
```
#### 5. Otvori preglednik
Idi na http://localhost:4200

---

## 📌 Napomene

- URL-ovi API-ja su hardkodirani na http://localhost:3001 u servisima (AuthService, TermsService, BookingService, AdminService)
- Session se prenosi preko HTTP-only cookie-ja; na frontend-u je bitan withCredentials (riješeno interceptorom)
- Za produkciju:
  - Postaviti secure: true za session cookie (HTTPS)
  - Podesiti ispravan CLIENT_ORIGIN
  - Odraditi production build Angulara i poslužiti ga preko reverse proxy-ja ili odvojenog static hosta
  - Preporučuje se koristiti environment varijable za API URL-ove umjesto hardkodiranih vrijednosti

---

## 📄 Licenca

Ovaj projekt je izrađen u svrhu učenja i demonstracije. Možeš ga slobodno koristiti, modificirati i širiti.

