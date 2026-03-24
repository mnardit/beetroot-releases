<p align="center">
  <img src="docs/screenshots/main.png" alt="Beetroot — gestor de portapapeles para Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  El gestor de portapapeles que Windows debería haber incluido.<br/>
  Transformaciones con IA, OCR y búsqueda difusa en todo el historial — a un atajo de distancia.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Versión"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Descargas"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Gratis">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Descargar Beetroot (gratis)</strong></a> · <a href="https://max.nardit.com/beetroot">Sitio web</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <b>Español</b> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> **Nuevo en v1.6.3:** Superposición "Copiado" a nivel de sistema confirma cada captura junto al cursor. Corregida la copia de imágenes del Explorer. Modelos OpenAI actualizados a GPT-5.4. [Ver novedades →](https://github.com/mnardit/beetroot-releases/releases/tag/v1.6.3)

---

## ¿Por qué no Win+V?

| Función | Win+V | Beetroot |
|---|---|---|
| Historial | 25 clips, se pierden al reiniciar | Ilimitado, persistente entre reinicios |
| Búsqueda | No | Difusa + regex |
| Transformaciones IA | No | 4 proveedores cloud + modelos locales, 10 integradas + personalizadas |
| Seguimiento de app origen | No | Icono, nombre y título de ventana por clip |
| OCR | No | Motor nativo de Windows, local |
| Historial de imágenes | Solo miniaturas | Imágenes completas, almacenadas localmente |
| Temas | No | 9 temas + modo Auto + color de acento |
| Pegar como texto plano | No | Atajo dedicado |
| Multi-monitor | No | La ventana sigue al cursor |
| Fijar arriba | No | Fijar + arrastrar a cualquier lugar |
| Notas | No | Anotaciones con búsqueda |

---

## Véalo en acción

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — búsqueda difusa en el historial del portapapeles" width="600">
</p>

| Transformaciones IA | Temas |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="Traducción y corrección gramatical con IA" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Cambio de temas" width="400"> |

<details>
<summary>Más capturas de pantalla</summary>

| Tema oscuro | Tema claro |
|---|---|
| ![Oscuro](docs/screenshots/main.png) | ![Claro](docs/screenshots/main-light-filters.png) |

| Menú contextual e IA | Vista previa de código |
|---|---|
| ![Menú contextual](docs/screenshots/context-menu.jpg) | ![Vista previa](docs/screenshots/preview-code.png) |

| Búsqueda | Menú de transformaciones IA |
|---|---|
| ![Búsqueda](docs/screenshots/search-results.png) | ![Transformaciones](docs/screenshots/transform-menu.png) |

| Configuración | Idiomas |
|---|---|
| ![Configuración](docs/screenshots/settings-general-new.png) | ![Idiomas](docs/screenshots/settings-languages.png) |

</details>

---

## Instalación

**[Descargue el último .exe desde GitHub Releases](https://github.com/mnardit/beetroot-releases/releases/latest)**

O use un gestor de paquetes:

```powershell
# Winget
winget install MNardit.Beetroot

# Scoop
scoop bucket add beetroot https://github.com/mnardit/scoop-bucket
scoop install beetroot

# Chocolatey
choco install beetroot
```

**Requisitos:** Windows 10 o posterior.

---

## Características

### Búsqueda y flujo de trabajo

- **Búsqueda de 5 fases** — subcadena exacta → inicio de palabra → metadatos → difusa. Tolerancia a errores con resultados clasificados
- **Modo regex** — `/pattern/` con resaltado de coincidencias
- **Filtros** — texto, imágenes, favoritos, notas — un clic para filtrar
- **Pegado rápido** — `Ctrl+1..9` para pegar clips recientes sin abrir la ventana
- **Operaciones por lotes** — selección múltiple con `Ctrl+Click`, luego copiar (separador personalizable) o eliminar
- **Detección de contenido** — badges automáticos para URLs, emails, código, JSON, colores. Detección de lenguajes de programación con ML (54 idiomas) para vista previa de código
- **Instancia única** — abrir Beetroot de nuevo enfoca la ventana existente

### Transformaciones IA

- **4 proveedores en la nube + local** — OpenAI, Gemini, Claude, DeepSeek o local (LM Studio, Ollama), cambio con un clic
- **Modelos de razonamiento** — Qwen3, DeepSeek R1 y similares funcionan directamente (elimina automáticamente las etiquetas `<think>`)
- **10 prompts integrados** — corregir gramática, traducir, resumir, reescribir, extraer datos, formatear como código y más
- **Prompts personalizados** — cree hasta 20 propios, accesibles desde el menú contextual
- **BYOK** — use su propia clave de OpenAI, o prescinda de ella con un modelo local

<details>
<summary>Modelos locales recomendados para transformaciones de texto</summary>

| Modelo | Tamaño | Velocidad | Ideal para |
|-------|------|-------|----------|
| **Qwen3 8B** (Q4_K) | ~5 GB | Rápido | Gramática, traducción, reescritura |
| **Gemma 3 4B** (Q4_K) | ~3 GB | Muy rápido | Corrección de errores, reescrituras simples |
| **Phi-4 Mini 3.8B** (Q4_K) | ~2.5 GB | Muy rápido | Código y texto estructurado |
| **Llama 3.1 8B** (Q4_K) | ~5 GB | Rápido | Uso general |
| **Mistral Small 3.1 24B** (Q4_K) | ~14 GB | Lento (16+ GB VRAM) | Calidad premium |
| **DeepSeek R1 7B** (Q4_K) | ~5 GB | Rápido | Reescrituras complejas, resúmenes |

Probado con [LM Studio](https://lmstudio.ai), [Ollama](https://ollama.com) y [llama.cpp](https://github.com/ggml-org/llama.cpp). Configure en Configuración → IA → LLM Local.

</details>

### Seguimiento de app origen

- **Vea de dónde proviene cada clip** — icono de la app, nombre y título de ventana
- **Filtre por app** — desplegable "Apps" con búsqueda, ordenar por último uso / más usado / alfabético
- **Incluido en búsquedas** — la app origen y el título de ventana se incluyen en la búsqueda difusa y regex

### OCR

- **Extraer texto de imágenes** — clic derecho en cualquier imagen → OCR
- **Motor nativo de Windows** — sin nube, sin subidas, totalmente offline
- **Instantáneo** — asíncrono, nunca bloquea la interfaz

### Personalización

- **9 temas** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), más modo Auto
- **Efectos de ventana** — Mica, Acrylic o Solid; detectados automáticamente según la versión de Windows
- **Tipografía** — 8 fuentes de interfaz, 5 fuentes de código, 6 tamaños predefinidos
- **26 idiomas** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Fijar ventana** — siempre visible, arrastrar entre monitores, o modo seguir cursor
- **Todos los atajos personalizables** — reasigne todo en Configuración → Atajos; compatible con AZERTY, QWERTZ y AltGr

### Fiabilidad

- **Copias de seguridad automáticas** — rotación de 3 copias + snapshot antes de cada actualización
- **Auto-recuperación** — detecta corrupción, restaura desde backup silenciosamente
- **Avisos de sincronización en la nube** — alerta si la carpeta de datos está en OneDrive, Dropbox o Google Drive
- **Detección de unidad** — avisa antes de escribir en USB o unidades de red
- **Auto-actualización** — actualizador integrado, o desactivar para operación completamente offline

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `` Ctrl+` `` | Mostrar / ocultar Beetroot |
| `Enter` | Pegar clip seleccionado |
| `Ctrl+1..9` | Pegado rápido |
| `Space` | Vista previa |
| `Alt+T` | Transformar con IA |
| `Alt+P` | Fijar ventana arriba |
| `Alt+F` | Modo seguir cursor |
| `Shift+F10` | Menú contextual |
| `Ctrl+C` | Copiar al portapapeles |
| `Alt+Del` | Eliminar |

Todos los atajos son personalizables en **Configuración → Atajos**. Compatible con layouts AZERTY, QWERTZ y AltGr.

---

## FAQ

**¿Beetroot es gratis?**
Sí. Gratis para uso personal y comercial — sin anuncios, sin pruebas, sin limitaciones, sin telemetría.

**¿Beetroot envía los datos del portapapeles a algún lugar?**
No. Todo se almacena en una base de datos SQLite local en su máquina. Con un modelo de IA local, nada sale de su equipo. Si usa un proveedor en la nube (OpenAI, Gemini, Anthropic o DeepSeek), solo el texto que usted transforma explícitamente se envía — directamente a su API usando su propia clave.

**¿Dónde se almacena mi clave API?**
En la configuración local de la app (localStorage en el perfil WebView2). Nunca sale de su máquina.

**¿Dónde se almacenan mis datos?**
Por defecto en `%APPDATA%\com.beetroot.desktop\`. Puede moverlos en Configuración → Datos. La base de datos es un archivo SQLite estándar — haga backup copiando la carpeta.

**¿Funciona la auto-actualización?**
Sí, desde v1.0.6. Los usuarios de v1.0.5 o anterior necesitan [descargar manualmente](https://github.com/mnardit/beetroot-releases/releases/latest) una vez — después la auto-actualización funciona normalmente. Puede desactivarla en Configuración → General.

---

## Solución de problemas

**La auto-actualización no funciona (v1.0.5 o anterior)**
Un cambio único en la clave de firma requiere [descargar la última versión manualmente](https://github.com/mnardit/beetroot-releases/releases/latest). Las actualizaciones futuras funcionarán automáticamente.

**OCR no funciona o baja calidad**
OCR usa el motor nativo de Windows. Asegúrese de que el paquete de idioma correspondiente está instalado: Configuración → Hora e idioma → Idioma → Agregar un idioma → marque "Voz" o "Escritura básica".

**Beetroot no abre o el atajo no funciona**
- Verifique si otra app está usando el mismo atajo (ej. `Ctrl+``)
- Intente ejecutar como administrador una vez para descartar problemas de permisos
- Reasigne el atajo en Configuración → Atajos

**Aviso de SmartScreen o antivirus**
Beetroot aún no tiene firma de código (certificado pendiente). Haga clic en "Más información" → "Ejecutar de todas formas" en SmartScreen. Puede verificar el hash del .exe con las [sumas de verificación del release](https://github.com/mnardit/beetroot-releases/releases/latest).

---

## Comentarios y reportes de errores

¿Encontró un error o tiene una sugerencia? [Abra un issue](https://github.com/mnardit/beetroot-releases/issues).

Por favor incluya:
- Versión de Beetroot (Configuración → Acerca de)
- Versión de Windows (`winver`)
- Pasos para reproducir
- Captura de pantalla o mensaje de error si aplica

---

## Licencia

Gratis para uso personal y comercial. El código fuente es propietario.

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Terms of Service](TERMS.md)

<details>
<summary>Fuentes de terceros y créditos</summary>

**Fuentes** (SIL Open Font License 1.1):
- [Inter](https://github.com/rsms/inter) — Copyright 2020 The Inter Project Authors
- [Open Sans](https://github.com/googlefonts/opensans) — Copyright 2020 The Open Sans Project Authors
- [Montserrat](https://github.com/JulietaUla/montserrat) — Copyright 2011 The Montserrat Project Authors
- [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic) — Copyright 2022 The Noto Project Authors
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — Copyright 2020 The JetBrains Mono Project Authors

**Creado con:** [Tauri v2](https://tauri.app/) · React 19 · Rust · SQLite · TypeScript

</details>

---

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Descargar Beetroot</strong></a> · ¿Te gusta? Una ⭐ ayuda a que otros lo descubran.
</p>

<p align="center">
  Creado por <a href="https://max.nardit.com">Max Nardit</a>
</p>
