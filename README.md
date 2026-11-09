# Historia clínica (prácticas de Enfermería y TCAE)

Aplicación de **historia clínica simulada** para docencia, integrada con el [Campus](https://github.com/luisfrse/campus). El profesorado crea pacientes ficticios con una ficha base que **no puede modificar el alumnado**; el alumnado registra su seguimiento y los cuidados que realiza, y cada registro queda firmado con su identidad del Campus.

Node 22, sin framework ni dependencias, SQLite integrado, bilingüe castellano/catalán. Mismo patrón de despliegue que el Campus (Dockerfile + Coolify).

## Cómo funciona

- **Ficha base del paciente** (profesorado): filiación, ingreso, diagnóstico, antecedentes, alergias, medicación habitual, valoración basal, situación social… más dos campos **solo para el profesorado** (notas y objetivos de aprendizaje) que el alumnado nunca recibe. Si la editas, se guarda una revisión de la versión anterior.
- **Asignación**: un mismo paciente se asigna a tantos alumnos como quieras (p. ej. 30). Dos modos:
  - **Individual**: una historia de trabajo independiente por alumno. Cada uno ve la ficha y **solo sus propios registros**.
  - **Equipo**: una historia compartida; los miembros ven los registros de su equipo.
- **Profesorado ve todo**: cada historia, la actividad de todo el alumnado sobre un paciente (filtrable por alumno), puede comentar registros, anular, cerrar o reabrir historias.
- **Registros del alumnado** (nota de evolución, constantes, balance hídrico, cuidado realizado): **solo se añaden**. No se editan ni se borran; se **anulan con motivo** (queda visible, tachado, con quién y por qué) y se puede añadir uno corregido que referencia al anterior. Cada registro guarda autor, perfil y fecha/hora del hecho y de la anotación.
- **Perfiles**: *Enfermería* (todo) y *TCAE* (solo cuidados propios de auxiliar). El perfil sale de la asignatura del Campus (configurable en Alumnado) y se puede fijar a mano por alumno.
- **Catálogo de cuidados propio y editable** (higiene, movilidad, nutrición, eliminación, seguridad, procedimientos de enfermería…), con quién puede registrar cada uno. No reproduce textos con copyright de NANDA/NOC/NIC.
- **Auditoría** de accesos y acciones de gestión.

Todos los datos de pacientes deben ser **ficticios**.

## Integración con el Campus (acceso único)

1. El alumno pulsa **Historia clínica** en *Mi espacio* del Campus (o el administrador visita `/api/historia/sso` con su sesión de admin).
2. El Campus redirige a `HISTORIA/sso?t=<token>`: un token firmado (HMAC-SHA256) con email, nombre, idioma y asignaturas activas. **Caduca a los 60 s y solo vale una vez.**
3. La historia crea su propia sesión (cookie HttpOnly). No se comparten contraseñas ni cookies entre apps.
4. **Sincronizar alumnado del Campus** (botón en Alumnado/ficha del paciente) trae la lista de matriculados para poder asignarles pacientes antes de que entren por primera vez.

### Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `SSO_SECRET` | Historia | Secreto compartido de firma. **Mismo valor** que `HISTORIA_SSO_SECRET` del Campus. Larga y aleatoria. |
| `CAMPUS_URL` | Historia | `https://campus.luisfs.com` |
| `CAMPUS_TOKEN` | Historia | Mismo valor que `HISTORIA_TOKEN` del Campus (para sincronizar alumnado). |
| `ADMIN_PASSWORD` | Historia | Opcional: acceso de administración directo sin pasar por el Campus. |
| `HISTORIA_URL` | Campus | `https://historia.luisfs.com` (activa el botón en Mi espacio). |
| `HISTORIA_SSO_SECRET` | Campus | El secreto de firma. |
| `HISTORIA_TOKEN` | Campus | Token para `GET /api/historia/roster`. |

## Despliegue en Coolify

1. Recurso desde este repositorio (Dockerfile, puerto 3000), dominio `historia.luisfs.com`.
2. **Persistent Storage**: volumen en `/data` (la base de datos). Sin él se pierde todo al redesplegar.
3. Variables de la tabla anterior (las tres del lado Campus requieren redesplegar el Campus).
4. Copia de seguridad periódica de `/data`.

## Desarrollo

```
npm test        # 12 pruebas de API: SSO, aislamiento entre alumnos, inmutabilidad, perfiles, CSRF
npm start       # http://localhost:3000 (usa ADMIN_PASSWORD=... para entrar sin Campus)
```

## Seguridad

- Cookie HttpOnly/SameSite, CSRF por cabecera + comprobación de origen, CSP estricta (sin scripts ni estilos inline), límite de intentos en login y SSO, tokens SSO de un solo uso.
- El alumnado solo accede a las historias de las que es miembro; el resto responde 404. La ficha que recibe se filtra en el servidor (los campos de profesorado no viajan al navegador).
- El profesorado no puede escribir registros como alumno.
- Las anulaciones no borran datos. Solo se eliminan historias vacías (sin registros).

## Hoja de ruta

- **Fase 2**: prescripciones médicas y hoja de administración de medicación (MAR), escalas (Barthel, Braden, Norton, Glasgow, Downton, EVA), valoración por patrones de Gordon / necesidades de Henderson, gráficas de constantes y balance hídrico por turnos, pruebas complementarias liberadas por días (línea temporal de la estancia).
- **Fase 3**: plan de cuidados (diagnóstico → objetivos → intervenciones → evaluación), informe de enfermería / alta, nota por caso con rúbrica enviable a la hoja de notas del Campus, exportación a PDF, otros profesores.
