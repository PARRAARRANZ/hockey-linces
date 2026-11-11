# Hockey Línea · Linces de Zaratán — app Android y web

Creado por JPA.

Este proyecto convierte el juego (`www/index.html`) en una app Android con Capacitor. GitHub la compila gratis, así que no hace falta instalar nada en el ordenador.

## Sacar el APK con GitHub (recomendado)

1. Crea un repositorio nuevo en GitHub, por ejemplo `hockey-linces`. Puede ser privado.
2. Sube **todo el contenido de esta carpeta**, incluida la carpeta oculta `.github`, a la rama `main`. Desde la web: *Add file → Upload files* y arrastra todo.
3. Ve a la pestaña **Actions**. Se lanza solo el proceso **«APK Android»**, que tarda unos 5 minutos.
4. Cuando acabe con el tic verde, entra en él. Abajo, en **Artifacts**, descarga `hockey-linces-apk`. Es un zip con `hockey-linces.apk` dentro.
5. Pasa el APK al móvil Android y ábrelo. La primera vez el móvil pedirá permiso para *instalar apps de origen desconocido*: acéptalo.

Cada vez que cambies el juego (`www/index.html`) y lo subas, se genera un APK nuevo.

La app se abre a pantalla completa y en horizontal, con el lince como icono.

## Web para iPhone (enlace público)

1. En el repositorio, entra en **Settings → Pages** y en *Source* elige **GitHub Actions**.
2. El proceso **«Web (GitHub Pages)»** publica el juego en una dirección del tipo `https://TU_USUARIO.github.io/hockey-linces/`. Para eso, el repositorio debe ser público o tu plan de GitHub debe permitir Pages en repositorios privados.
3. En el iPhone, abre ese enlace en Safari y pulsa **Compartir → Añadir a pantalla de inicio**. Así se abre sin barras, como una app.

Limitaciones en iPhone:
- Safari no permite bloquear el giro de pantalla. Si el móvil está en vertical, el juego pide girarlo.
- El sonido no suena si el interruptor de silencio está activado.
- El iPhone no vibra con los goles.

## Alternativa: compilar en tu ordenador con Android Studio

Necesitas Node.js 20 y Android Studio.

```
npm install
npx cap add android
./patch-android.sh
npx capacitor-assets generate --android
npx cap sync android
npx cap open android
```

En Android Studio: *Build → Build App Bundle(s) / APK(s) → Build APK(s)*.

## Publicar en Google Play (opcional)

Para Google Play hace falta una versión **firmada** (AAB) y una cuenta de desarrollador de Google, que cuesta 25 $ una sola vez. Si llegas a ese punto, se puede añadir la firma al proceso de GitHub.

## Controles

- **Táctil**: joystick a la izquierda; **TIRO** (mantener para cargar), **PASE** y **PRESIÓN** a la derecha.
- **Teclado**: cursores, Espacio (tiro), M (pase), B (presión), C (cámara), P (pausa).
- **Mando**: stick, A (tiro), B/X (pase), Y/RB (presión), Start (pausa).
