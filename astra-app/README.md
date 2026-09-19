# Fly — versión 100% gratis

(El proyecto se llama internamente "astra-app" en carpetas y archivos; el nombre visible de tu IA dentro de la app es **Fly**. Puedes renombrar la carpeta si quieres, no afecta el funcionamiento.)

Chat con IA (Google Gemini, gratis) + backend propio + base de datos.
No necesitas pagar nada: ni la IA, ni el hosting, ni un dominio (usarás uno gratis).

## Lo que vas a hacer, en resumen

1. Conseguir una clave gratis de Google (2 minutos).
2. Probarlo en tu computadora (5 minutos).
3. Subirlo a Render.com gratis para que tenga una URL pública (10 minutos).

No hace falta tarjeta de crédito en ningún paso.

---

## Paso 1 — Consigue tu clave gratis de Gemini

1. Entra a https://aistudio.google.com/apikey con tu cuenta de Google.
2. Haz clic en "Create API key".
3. Copia la clave (empieza con algo como `AIza...`). La usarás en el paso 2.

Esto es gratis de forma indefinida (con un límite diario de usos, más que suficiente
para un proyecto personal).

## Paso 2 — Pruébalo en tu computadora

Necesitas tener Node.js instalado (https://nodejs.org, versión LTS, es gratis).

```bash
cd astra-app
npm install
cp .env.example .env
```

Abre el archivo `.env` con cualquier editor de texto y pega tu clave:

```
GEMINI_API_KEY=AIza...tu_clave_aqui
```

Luego:

```bash
npm start
```

Abre `http://localhost:3000` en tu navegador. Ya deberías poder chatear con Fly.

## Paso 3 — Publícalo gratis en internet (Render.com)

1. Crea una cuenta gratis en https://render.com (puedes entrar con tu cuenta de GitHub).
2. Sube la carpeta `astra-app` a un repositorio de GitHub (si no sabes cómo, dime y
   te lo explico paso a paso).
3. En Render: "New" -> "Web Service" -> selecciona tu repositorio.
4. Configura:
   - Build command: `npm install`
   - Start command: `npm start`
5. Antes de desplegar, ve a "Environment" y agrega:
   - `GEMINI_API_KEY` = tu clave del paso 1
   - `APP_PASSWORD` = una contraseña que inventes tú (importante, ver abajo)
6. Haz clic en "Create Web Service". En unos minutos te da una URL como
   `https://astra-xxxx.onrender.com` — esa es tu app (Fly), ya funcionando, gratis.

Esa URL ya es tu "dominio" gratuito. Si más adelante quieres un dominio propio como
`astra.com`, eso sí cuesta dinero (~10-15 USD al año) y es un paso aparte, opcional.

## Importante: pon una contraseña (APP_PASSWORD)

Sin esto, cualquier persona que encuentre tu URL puede usar tu cuota gratuita de
Gemini y agotarla en minutos. Al definir `APP_PASSWORD`, la app te pedirá esa
contraseña la primera vez que la abras (se guarda en el navegador).

## Cosas a tener en cuenta con el plan gratis de Render

- El servicio "se duerme" tras 15 minutos sin uso; la primera visita después de eso
  tarda unos 30-60 segundos en responder mientras despierta. Es normal.
- El archivo de base de datos (`data/astra.db`, donde se guardan tus conversaciones
  y notas de memoria) puede borrarse si Render reinicia el servicio, porque el plan
  gratis no incluye almacenamiento permanente. Para un proyecto personal esto rara vez
  es un problema; si más adelante te importa conservar el historial para siempre,
  se puede conectar una base de datos gratuita que sí persiste (te ayudo cuando
  llegues a ese punto).

## Si algo no funciona

- "Failed to fetch" o error de red al chatear: revisa que copiaste bien la clave en
  `GEMINI_API_KEY`, sin espacios.
- La app pide contraseña y no la aceptas: es la que pusiste tú en `APP_PASSWORD`.
- Localhost no abre: confirma que `npm start` no mostró ningún error en la terminal.

## Próximos pasos posibles (cuando quieras)

- Generación de imágenes real.
- Voz (hablar y escuchar respuestas).
- Dominio propio.

## Cómo "mejora" Fly con el uso (memoria automática)

Fly no se reentrena a sí mismo (ningún chatbot lo hace de verdad sin un proceso
de entrenamiento aparte, que es costoso). Lo que sí hace, de forma real, es esto:

Después de cada intercambio, Fly revisa en segundo plano si dijiste algo duradero
y útil (una preferencia, un dato de tu proyecto, una decisión) y, si lo hay, lo
guarda solo en la sección "Memoria". La próxima vez que chatees, esa memoria se
incluye automáticamente para que Fly responda con más contexto — así es como
"se va conociendo mejor" con cada conversación, sin que tengas que repetirte.

Puedes ver, borrar o desactivar todo lo que ha aprendido desde el botón "Memoria"
del panel lateral.

## Funciones que ya agregué en esta versión

- Respuestas más largas y completas (útil para documentos, código o planes extensos).
- Botón para descargar cualquier respuesta como archivo .md.
- Botón para copiar cualquier bloque de código con un clic.
- Botón "Regenerar" si una respuesta no te convenció.
- Aprendizaje automático de memoria (ver arriba).

## Generación de imágenes (gratis, hiperrealista)

Hay un botón nuevo junto al de adjuntar archivo (ícono de imagen) en el cuadro de
mensaje. Actívalo, describe lo que quieres, y Fly:

1. Usa Gemini (gratis) para reescribir tu descripción como un prompt fotorrealista
   más detallado — mismo contenido que pediste, mejor descrito.
2. Genera la imagen con Pollinations.ai (modelo Flux), un servicio gratuito y sin
   límite diario, sin marca de agua.

Cada imagen trae tres botones: **Descargar** (guarda el archivo tal cual, sin
comprimir), **Subir calidad** (regenera al doble de resolución, hasta 2048×2048,
así nunca "baja" la calidad — solo puedes pedir más) y **Otra variante** (mismo
prompt, resultado distinto).

Importante para que sepas: Pollinations no es un servicio oficial de Google ni de
Anthropic, es un proyecto independiente y gratuito; su disponibilidad puede variar
de vez en cuando. Si algún día quieres el nivel de Nano Banana Pro de Google (más
consistente, con texto perfecto en las imágenes), eso sí tiene costo por imagen
(unos 4 a 24 centavos de dólar) — puedo integrarlo cuando tengas presupuesto para
esa parte específica, dejando todo lo demás igual de gratis.

## Nuevas funciones (para competir con las mejores IAs)

- **Respuestas en tiempo real**: el texto aparece progresivamente mientras Fly
  "piensa", igual que ChatGPT, Claude o Gemini. Es la misma API gratuita, solo
  cambia cómo se recibe.
- **Dictado por voz**: botón de micrófono junto al de enviar. Usa el
  reconocimiento de voz nativo del navegador (funciona mejor en Chrome).
  Es gratis, no llama a ningún servicio externo.
- **Lectura en voz alta**: botón "Escuchar" en cada respuesta de Fly, usa la
  voz nativa del navegador. También gratis.
- **Editar mensajes**: botón "Editar" bajo tus propios mensajes. Recupera el
  texto en el cuadro de escritura y descarta la respuesta que le siguió, para
  que puedas corregir y reenviar sin reescribir toda la conversación.

Nota sobre el dictado y la lectura por voz: dependen del navegador de quien use
la app (no de tu servidor), así que la calidad y el idioma disponible varían
según el dispositivo. En Chrome de escritorio y Android funcionan muy bien; en
Safari/iOS el dictado es más limitado.
