# Análisis funcional — Kling 3.0 Prompt Builder

## Novedad implementada: Análisis con IA (Enhance)
- Se agregó un bloque **Análisis con IA** con:
  - campo de API key,
  - selector de modelo,
  - botón `Analizar con IA`,
  - opción `Aplicar Enhance IA al crear prompt`.
- En **Single Shot**, la IA analiza First/Last frame y devuelve:
  - descripción de ambos frames,
  - notas de continuidad,
  - idea base mejorada,
  - sugerencias de cámara y naturalidad.
- En **Multishot (Referencias)**, la IA analiza hasta 5 imágenes y devuelve por referencia:
  - tipo de plano,
  - encuadre,
  - personaje,
  - acción,
  - motivación,
  - comportamiento de cámara,
  además de idea mejorada y sugerencias globales.

## Integración al prompt
- El botón `Crear prompt` ahora puede usar resultados de IA para enriquecer automáticamente:
  - secciones HERO/FINAL,
  - IDEA BASE,
  - sugerencias de cámara/naturalidad,
  - análisis de referencias.
