# score-following-app

This is a simple score following app that reads a score file (MusicXML) and displays the aligned position in real-time using an Audio/MIDI input device. For the core alignment algorithm, we use the [pymatchmaker](https://github.com/pymatchmaker/matchmaker), a Python library for real-time music alignment. (ISMIR 2024 Late Breaking Demo)

---

## Pre-requisites

- **Python Version**: 3.9 (other versions will be supported soon!)
- **System Dependencies**:
  - [Fluidsynth](https://www.fluidsynth.org/)
  - [PortAudio](https://www.portaudio.com/)

```bash
# Linux
$ sudo apt-get install fluidsynth && sudo apt-get install portaudio19-dev

# MacOS
$ brew install fluidsynth && brew install portaudio
```

---

## Setting Backend Environment

### **1. Cloud Service (Server Backend)**

The cloud service is designed to run inside a Docker container.

#### **Using Docker Compose**

You can use the provided `docker-compose.yml` file to set up both the PostgreSQL database and the Cloud Service.

##### **Steps to Set Up**

1. **Navigate to the project root directory**:
   ```bash
   $ cd d:\Develop\Projects\score-following-app
   ```

2. **Start the services**:
   ```bash
   $ docker-compose up -d
   ```

   - This will start the following services:
     - **PostgreSQL**: Runs on `localhost:5432`.
     - **Cloud Service**: Runs on `http://localhost:8101/`.

3. **Verify the services**:
   - Check running containers:
     ```bash
     $ docker ps
     ```
   - You should see `score-following-postgres` and `score-following-cloud-service` in the list.

4. **Initialize the database**:
   - Run the following command to create the database tables:
     ```bash
     $ docker exec -it score-following-cloud-service sh -c "python -m app.database"
     ```
   - This will create all the necessary tables in the PostgreSQL database.
  
5. **Migrations the database**:
   - Run the following command to migrations the database tables:
     ```bash
     $ alembic revision --autogenerate -m "Add midi_path and audio_path to UploadedFile"
     $ alembic upgrade head
     ```

#### **Debug Cloud Service**

If you need to debug the Cloud Service, you can run it in debug mode using the `DEBUG` environment variable.

##### **Steps to Debug**

1. **Run the Docker container in debug mode**:
   ```bash
   $ docker-compose down  # Stop any running containers
   $ docker run -it -p 8101:8101 -p 5678:5678 -e DEBUG=true --name SF-Cloud-Service-Debug score-following-cloud-service
   ```

2. **Attach a debugger**:
   - Use a debugger like Visual Studio Code or PyCharm.
   - Attach to the debug server at `localhost:5678`.

3. **Start Debugging**:
   - The service will wait for the debugger to connect before starting.

---

### **2. Device Service (Client Backend)**

The device service is designed to run directly on the host machine (not in Docker).

#### **Set Up Python Environment**

```bash
$ cd backend/device-service/
$ conda create -n sfa-device python=3.9
$ conda activate sfa-device
$ pip install -r requirements.txt
```

#### **Run Device Service**

```bash
$ uvicorn app.main:app --host 0.0.0.0 --port 8201
```

- The device service will be available at `http://localhost:8201/`.

---

## Setting Frontend Environment

### **Install Dependencies**

```bash
$ cd frontend/
$ npm install
```

### **Set Backend URL**

Create a `.env.local` file in the `frontend/` directory:

```bash
$ Set-Content -Path .env.local -Value "NEXT_CLOUD_BACKEND_URL=http://127.0.0.1:8101`nNEXT_LOCAL_BACKEND_URL=http://127.0.0.1:8201"
```

### **Run Frontend**

```bash
$ npm start
or
$ npm run start-win
```

- The frontend will be available at `http://localhost:50003/`.

---

## Running the App

### **Backend Services**

1. **Cloud Service**:
   - Run the Docker container:
     ```bash
     $ docker-compose up -d
     ```

2. **Device Service**:
   - Run the service directly:
     ```bash
     $ uvicorn app.main:app --host 0.0.0.0 --port 8201
     ```

### **Frontend**

- Start the frontend:
  ```bash
  $ cd frontend/
  $ npm start
  ```

- Access the app at `http://localhost:50003/`.

---

## Demo Video

[Demo Video Link](https://github.com/user-attachments/assets/a8010f8b-45a1-4be5-8cd1-f65a9601f8eb)

---

## Notes

1. **Cloud Service**:
   - Runs in Docker on port `8101`.
   - Handles user management, file uploads, and score preprocessing.
   - **Debugging**: Use the `DEBUG=true` environment variable to enable debug mode. Attach a debugger to port `5678`.

2. **Device Service**:
   - Runs directly on the host machine on port `8201`.
   - Handles real-time audio/MIDI input and position tracking.

3. **Frontend**:
   - Runs on port `50003`.
   - Communicates with the cloud service for backend operations.

4. **First Startup**:
   - The first startup of the backend services might take longer as it downloads required soundfonts and dependencies.

# iMusic Android Development Guide

## Prerequisites
- Android Studio
- Node.js (v16 or higher recommended)
- npm or yarn
- Android Emulator or physical device

## Development Environment Setup

### 1. Frontend Development Environment
```bash
# Navigate to frontend project directory
cd frontend

# Install dependencies
npm install
# or
yarn install

# Start development server
npm run dev
# or
yarn dev
```

### 2. Android Development Environment
1. Open Android Studio
2. Open the `android` directory as a project
3. Wait for Gradle sync to complete

## Testing the App on Android

### 1. Configure Emulator
1. Open Android Studio's AVD Manager
2. Create a new virtual device (if not already created)
   - Select device type (e.g., Pixel 4)
   - Choose system image (API 30 or higher recommended)
   - Complete the creation

### 2. Launch the App
1. Ensure the frontend development server is running (`npm run dev` or `yarn dev`)
2. Click the "Run" button (green triangle) in Android Studio
3. Select target device (emulator or physical device)
4. Wait for app installation and launch

### 3. Debugging Tips
- Using Chrome DevTools for debugging
  1. Visit `chrome://inspect` in Chrome browser
  2. Ensure device is connected and recognized
  3. Click "inspect" to open debugging tools

- View logs
  ```bash
  adb logcat | grep "iMusic"
  ```

### 4. Troubleshooting Common Issues
1. If encountering network connection issues:
   - Ensure using `10.0.2.2` instead of `localhost` for local server access
   - Verify correct ports (frontend default 50003, backend 8101/8201)

2. If encountering white screen:
   - Check if Metro server is running
   - Try clearing app data and cache
   - Rebuild the application

3. If encountering build errors:
   ```bash
   # Clean project
   cd android
   ./gradlew clean
   ```

## Deployment Process

### 1. Building Production Version
```bash
# Frontend build
cd frontend
npm run build
# or
yarn build

# Android build
npx cap open android
./gradlew assembleRelease
```

### 2. Testing Production Version
1. Install release version on emulator or device
2. Verify all functionality works correctly
3. Check performance metrics

## Important Notes
- Ensure correct backend URL configuration in `common.ts`
- Use `10.0.2.2` for local server access in development environment
- Keep frontend and Android code in sync
- Regularly test all features to ensure compatibility

## Useful Commands
```bash
# Clean Android build
cd android
./gradlew clean

# View connected devices
adb devices

# Install APK
adb install app/build/outputs/apk/release/app-release.apk

# Uninstall app
adb uninstall com.imusic.app
```
