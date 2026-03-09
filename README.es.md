<p align="center">
  <img src="docs/screenshots/main-dark-new.png" alt="Beetroot — gestor de portapapeles para Windows" width="700" />
</p>

<h1 align="center">Beetroot</h1>

<p align="center">
  El gestor de portapapeles que Windows debería haber incluido.<br/>
  Transformaciones con IA, OCR, búsqueda difusa en todo el historial — todo con un atajo de teclado.
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><img src="https://img.shields.io/github/v/release/mnardit/beetroot-releases?label=version" alt="Versión"></a>
  <a href="https://github.com/mnardit/beetroot-releases/releases"><img src="https://img.shields.io/github/downloads/mnardit/beetroot-releases/total" alt="Descargas"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/price-free-brightgreen" alt="Gratis">
  <img src="https://img.shields.io/badge/source-proprietary-orange" alt="Propietario">
</p>

<p align="center">
  <a href="https://github.com/mnardit/beetroot-releases/releases/latest"><strong>Descargar</strong></a> · <a href="https://max.nardit.com/beetroot">Sitio web</a> · <a href="https://github.com/mnardit/beetroot-releases/releases">Changelog</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.de.md">Deutsch</a> · <b>Español</b> · <a href="README.ru.md">Русский</a> · <a href="README.zh.md">中文</a> · <a href="README.ja.md">日本語</a>
</p>

> Este repositorio contiene releases y documentación. El código fuente es propietario.

---

## Véalo en acción

<p align="center">
  <img src="docs/gif/search-demo.gif" alt="Beetroot — búsqueda difusa en el historial del portapapeles" width="600">
</p>

| Transformaciones IA | Temas |
|---|---|
| <img src="docs/gif/ai-transform.gif" alt="Traducción y corrección gramatical con IA" width="400"> | <img src="docs/gif/theme-switching.gif" alt="Cambio de temas" width="400"> |

| Tema oscuro | Tema claro |
|---|---|
| ![Oscuro](docs/screenshots/main-dark-new.png) | ![Claro](docs/screenshots/main-light-filters.png) |

<details>
<summary>Más capturas</summary>

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

> [!NOTE]
> **¿Actualizando desde v1.0.5 o anterior?** La actualización automática no funcionará debido a un cambio único en la clave de firma. [Descargue la última versión manualmente](https://github.com/mnardit/beetroot-releases/releases/latest) — todas las actualizaciones futuras funcionarán automáticamente.

**Requisitos:** Windows 10 o posterior.

---

## ¿Por qué no Win+V?

| Función | Win+V | Beetroot |
|---|---|---|
| Historial | 25 clips, se pierden al reiniciar | Ilimitado, persistente |
| Búsqueda | No | Difusa + regex |
| Transformaciones IA | No | 10 integradas + prompts personalizados |
| OCR | No | Motor nativo de Windows, local |
| Historial de imágenes | Solo miniaturas | Imágenes completas, almacenadas localmente |
| Temas | No | 9 temas + modo Auto + color de acento |
| Pegar como texto plano | No | Atajo dedicado |
| Multi-monitor | No | La ventana sigue al cursor |
| Fijar arriba | No | Fijar + arrastrar a cualquier lugar |
| Notas | No | Anotaciones con búsqueda |

---

## Inicio rápido

1. **Instalar** — descargue .exe o use winget/scoop/choco
2. **Abrir** — presione `` Ctrl+` `` (personalizable) para mostrar Beetroot
3. **Buscar** — escriba para búsqueda difusa, o use `/regex/`
4. **Favoritos y notas** — clic derecho → Favorito para fijar arriba, añada notas para contexto
5. **IA y OCR** — clic derecho → Transformar para IA, o clic derecho en una imagen → OCR

---

## Características

### Búsqueda y flujo de trabajo

- **Búsqueda difusa** — encuentra cualquier cosa con tolerancia a errores
- **Modo regex** — `/pattern/` para usuarios avanzados con resaltado
- **Filtros** — texto, imágenes, favoritos, notas — un clic para filtrar
- **Pegado rápido** — `Ctrl+1..9` para pegar clips recientes sin abrir la ventana
- **Operaciones por lotes** — selección múltiple con `Ctrl+Click`, copiar o eliminar en lote
- **Detección de contenido** — badges automáticos para URLs, emails, código, JSON, colores; clic para abrir
- **Instancia única** — abrir Beetroot de nuevo enfoca la ventana existente

### Transformaciones IA

- **10 prompts integrados** — corregir gramática, traducir, resumir, reescribir, extraer datos, formatear como código y más
- **Prompts personalizados** — hasta 20 propios, accesibles desde el menú contextual
- **BYOK** — use su propia clave de API de OpenAI; Beetroot nunca almacena ni redirige sus datos
- **GPT-5 nano/mini** — rápido y económico, optimizado para textos cortos

### OCR

- **Extraer texto de imágenes** — clic derecho en una imagen → OCR
- **Motor nativo de Windows** — sin nube, sin subidas, totalmente offline
- **Instantáneo** — se ejecuta de forma asíncrona, no bloquea la app

### Personalización

- **9 temas** — Beetroot Dark/Light, Tokyo Night Storm, Gruvbox, GitHub Light, Nord Snow, Cyberpunk Dark/Light, Pure Dark (OLED #000000), más modo Auto
- **Efectos de ventana** — Mica, Acrylic o Solid; detectados automáticamente según la versión de Windows
- **Tipografía** — 8 fuentes UI, 5 fuentes de código, 6 tamaños
- **26 idiomas** — EN, RU, DE, ES, ZH, JA, FR, PT, KO, TR, IT, PL, NL, UK, TH, HI, ID, VI, CS, HU, RO, SV, DA, FI, NB, MS
- **Fijar ventana** — siempre visible, arrastrar entre monitores, o modo seguir cursor
- **Todos los atajos personalizables** — reasigne todo en Configuración → Atajos; compatible con AZERTY, QWERTZ, AltGr

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
| `Alt+T` | Transformación IA |
| `Alt+P` | Fijar ventana arriba |
| `Alt+F` | Modo seguir cursor |
| `Shift+F10` | Menú contextual |
| `Ctrl+C` | Copiar al portapapeles |
| `Alt+Del` | Eliminar |

Todos los atajos son personalizables en **Configuración → Atajos**. Compatible con layouts AZERTY, QWERTZ y AltGr. Las etiquetas se actualizan al instante al cambiar con Win+Space.

---

## FAQ

**¿Beetroot es gratis?**
Sí. Gratis para uso personal y comercial — sin anuncios, sin pruebas, sin limitaciones, sin telemetría.

**¿Beetroot envía los datos del portapapeles a algún lugar?**
No. Todo se almacena en una base de datos SQLite local en su máquina. Las transformaciones IA envían solo el texto seleccionado a la API de OpenAI cuando usted elige transformar explícitamente — y solo usando su propia clave API.

**¿Qué se envía exactamente a OpenAI?**
Solo el texto en el que hace clic derecho → Transformar. La solicitud va directamente desde su máquina a la API de OpenAI. Beetroot nunca ve, almacena ni redirige sus datos. Sin clave API = cero solicitudes de red.

**¿Dónde se almacena mi clave API?**
En la configuración local de la app (localStorage en el perfil WebView2). Nunca sale de su máquina.

**¿Dónde se almacenan mis datos?**
Por defecto en `%LOCALAPPDATA%\com.beetroot.desktop\`. Puede moverlos en Configuración → Datos. La base de datos es un archivo SQLite estándar — haga backup copiando la carpeta.

**¿Funciona Beetroot en Windows 10?**
Sí. Windows 10 y 11 están soportados. Los efectos Mica y Acrylic están disponibles en Windows 11.

**¿Puedo abrir múltiples ventanas de Beetroot?**
No. Beetroot es de instancia única — abrirlo de nuevo enfoca la ventana existente.

**¿Funciona la auto-actualización?**
Sí, desde v1.0.6. Los usuarios de v1.0.5 o anterior necesitan [descargar manualmente](https://github.com/mnardit/beetroot-releases/releases/latest) una vez — después la auto-actualización funciona normalmente. Puede desactivarla en Configuración → General.

---

## Privacidad y seguridad

Sus datos permanecen en su máquina. Sin telemetría, sin analíticas, sin sincronización en la nube, sin cuenta.

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Terms of Service](TERMS.md)

---

## Solución de problemas

**La auto-actualización no funciona (v1.0.5 y anterior)**
Un cambio único en la clave de firma requiere [descargar la última versión manualmente](https://github.com/mnardit/beetroot-releases/releases/latest). Las actualizaciones futuras funcionarán automáticamente.

**OCR no funciona o baja calidad**
OCR usa el motor nativo de Windows. Asegúrese de que el paquete de idioma correspondiente está instalado: Configuración → Hora e idioma → Idioma → Agregar un idioma → marque "Voz" o "Escritura básica".

**Beetroot no abre o el atajo no funciona**
- Verifique si otra app está usando el mismo atajo (ej. `Ctrl+``)
- Intente ejecutar como administrador una vez
- Reasigne el atajo en Configuración → Atajos

**Aviso de SmartScreen o antivirus**
Beetroot aún no tiene firma de código (certificado pendiente). Haga clic en "Más información" → "Ejecutar de todas formas" en SmartScreen. Es un falso positivo — la app es segura.

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
  Creado por <a href="https://max.nardit.com">Max Nardit</a>
</p>
