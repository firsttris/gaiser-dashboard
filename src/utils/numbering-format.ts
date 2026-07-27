export function formatGeneratedNumber(template: string, counter: number, padding: number) {
  const now = new Date()
  const jahr = String(now.getFullYear())
  const monat = String(now.getMonth() + 1).padStart(2, '0')
  const tag = String(now.getDate()).padStart(2, '0')
  const nummer = String(counter).padStart(Math.max(padding, 1), '0')

  return template
    .replaceAll('{JAHR}', jahr)
    .replaceAll('{MONAT}', monat)
    .replaceAll('{TAG}', tag)
    .replaceAll('{NUMMER}', nummer)
}
