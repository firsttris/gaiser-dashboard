import { jsPDF } from 'jspdf'
import { type RecordItem } from '../state/app-state'
import { flowLabel, money } from './history-utils'

const LOGO_URL = `${import.meta.env.BASE_URL}assets/Logo.jpeg`
const LOGO_ASPECT_RATIO = 303 / 873

const COMPANY_INFO = {
  name: 'Gaiser GmbH Erdbau und Abbruch',
  street: 'Hansjakobweg 14',
  city: '77830 Bühlertal',
  phone: '+49 170 2416906',
  email: 'info@gaiser-abbruch.de',
  taxOffice: 'Finanzamt Baden-Baden',
  vatId: 'DE338636212',
  banks: [
    { name: 'Sparkasse Bühl', bic: 'SOLADES1BHL', iban: 'DE44 6625 1434 0000 5249 91' },
    { name: 'Volksbank Bühl', bic: 'GENODE61BHL', iban: 'DE96 6629 1400 0005 2942 23' },
  ],
  management: 'Geschäftsführer: Rolf Gaiser, Marius Schmidt | Reg.-Nr. HRB 738556 | Amtsgericht Mannheim',
}

let logoDataUrlPromise: Promise<string> | null = null

function loadLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_URL)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          }),
      )
  }
  return logoDataUrlPromise
}

function formatQty(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

function drawLetterhead(pdf: jsPDF, left: number, right: number, logoDataUrl: string) {
  const logoWidth = 50
  const logoHeight = logoWidth * LOGO_ASPECT_RATIO
  const logoCenterX = right - logoWidth / 2
  pdf.addImage(logoDataUrl, 'JPEG', right - logoWidth, 12, logoWidth, logoHeight)

  let y = 12 + logoHeight + 4
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(COMPANY_INFO.street, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(COMPANY_INFO.city, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(`Tel: ${COMPANY_INFO.phone}`, logoCenterX, y, { align: 'center' })
  y += 4.5
  pdf.text(COMPANY_INFO.email, logoCenterX, y, { align: 'center' })
  const addressBottom = y

  y = 38
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(120)
  pdf.text(`${COMPANY_INFO.name} | ${COMPANY_INFO.street} | ${COMPANY_INFO.city}`, left, y)
  pdf.setTextColor(0)

  return addressBottom
}

function drawCompanyFooter(pdf: jsPDF) {
  const left = 15
  const right = 195
  const col2 = left + 60
  const col3 = left + 110
  const y = 266

  pdf.setDrawColor(200)
  pdf.line(left, y, right, y)

  let fy = y + 5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.text(COMPANY_INFO.name, left, fy)
  pdf.text(COMPANY_INFO.taxOffice, col2, fy)
  pdf.text('Bankverbindungen:', col3, fy)

  fy += 4
  pdf.setFont('helvetica', 'normal')
  pdf.text(COMPANY_INFO.street, left, fy)
  pdf.text(`Umsatzsteuer-ID: ${COMPANY_INFO.vatId}`, col2, fy)
  pdf.setFont('helvetica', 'bold')
  pdf.text(COMPANY_INFO.banks[0].name, col3, fy)

  fy += 4
  pdf.setFont('helvetica', 'normal')
  pdf.text(COMPANY_INFO.city, left, fy)
  pdf.text(`SWIFT-BIC: ${COMPANY_INFO.banks[0].bic} | IBAN: ${COMPANY_INFO.banks[0].iban}`, col3, fy)

  fy += 4
  pdf.text(`Tel: ${COMPANY_INFO.phone}`, left, fy)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${COMPANY_INFO.banks[1].name}:`, col3, fy)

  fy += 4
  pdf.setFont('helvetica', 'normal')
  pdf.text(COMPANY_INFO.email, left, fy)
  pdf.text(`SWIFT-BIC: ${COMPANY_INFO.banks[1].bic} | IBAN: ${COMPANY_INFO.banks[1].iban}`, col3, fy)

  fy += 5
  pdf.setFontSize(7)
  pdf.setTextColor(100)
  pdf.text(COMPANY_INFO.management, (left + right) / 2, fy, { align: 'center' })
  pdf.setTextColor(0)
}

export type InvoiceCustomer = {
  customerNumber?: string
  street?: string
  postalCode?: string
  city?: string
}

export async function downloadInvoicePdf(
  invoiceRecords: RecordItem[],
  customer: InvoiceCustomer | undefined,
  deliveryNoteId: string | undefined,
  invoiceNo: string,
  reverseCharge = false,
): Promise<string> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  const right = 195

  const customerName = invoiceRecords[0].company
  const customerNumber = customer?.customerNumber
  const customerStreet = customer?.street
  const customerPostalCodeAndCity = [customer?.postalCode, customer?.city].filter(Boolean).join(' ')
  const invoiceDate = new Date().toLocaleDateString('de-DE')

  const logoDataUrl = await loadLogoDataUrl()
  const addressBottom = drawLetterhead(pdf, left, right, logoDataUrl)

  let y = 38 + 7
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(customerName, left, y)

  if (customerStreet) {
    y += 5
    pdf.text(customerStreet, left, y)
  }

  if (customerPostalCodeAndCity) {
    y += 5
    pdf.text(customerPostalCodeAndCity, left, y)
  }

  const metaLabelX = 122
  const metaRows: Array<[string, string]> = [
    ['Rechnungs-Nr.:', invoiceNo],
    ['Datum:', invoiceDate],
  ]
  if (customerNumber) metaRows.push(['Kunden-Nr.:', customerNumber])
  metaRows.push(['Seite:', '1 von 1'])

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  const metaValueX = metaLabelX + Math.max(...metaRows.map(([label]) => pdf.getTextWidth(label))) + 3

  let metaY = addressBottom + 8
  let seiteY = metaY
  for (const [label, value] of metaRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, metaLabelX, metaY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, metaValueX, metaY)
    if (label === 'Seite:') seiteY = metaY
    metaY += 5
  }

  y = Math.max(metaY, y) + 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(reverseCharge ? 'Rechnung §13b' : 'Rechnung', left, y)

  y += 9
  const siteNames = new Set(invoiceRecords.map((r) => r.constructionSiteName || '-'))
  const bauvorhaben = siteNames.size === 1 ? [...siteNames][0] : 'Diverse Baustellen'
  const zeitraum = `${invoiceRecords[invoiceRecords.length - 1].createdAt} - ${invoiceRecords[0].createdAt}`

  const detailLabels = ['Bauvorhaben:', 'Ausführungszeitraum:', ...(deliveryNoteId ? ['Lieferschein-Nr.:'] : [])]
  pdf.setFontSize(9.5)
  pdf.setFont('helvetica', 'bold')
  const detailValueX = left + Math.max(...detailLabels.map((label) => pdf.getTextWidth(label))) + 3

  pdf.text('Bauvorhaben:', left, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(bauvorhaben, detailValueX, y)
  y += 5
  pdf.setFont('helvetica', 'bold')
  pdf.text('Ausführungszeitraum:', left, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(zeitraum, detailValueX, y)

  if (deliveryNoteId) {
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.text('Lieferschein-Nr.:', left, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(deliveryNoteId, detailValueX, y)
  }

  y += 9
  pdf.setFontSize(9.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Wir bedanken uns für die gute Zusammenarbeit und stellen Ihnen folgende Leistungen in Rechnung:', left, y)

  y += 8

  const cols = {
    pos: left,
    bezeichnung: left + 10,
    anzahl: 120,
    einheit: 126,
    einzelpreis: 155,
    gesamtpreis: right,
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setFillColor(191, 191, 191)
  pdf.rect(left, y - 4.5, right - left, 6.5, 'F')
  pdf.text('Pos.', cols.pos, y)
  pdf.text('Bezeichnung', cols.bezeichnung, y)
  pdf.text('Anzahl', cols.anzahl, y, { align: 'right' })
  pdf.text('Einheit', cols.einheit, y)
  pdf.text('Einzelpreis', cols.einzelpreis, y, { align: 'right' })
  pdf.text('Gesamtpreis', cols.gesamtpreis, y, { align: 'right' })

  y += 2.5
  pdf.setDrawColor(180)
  pdf.line(left, y, right, y)
  y += 7

  let subtotal = 0
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)

  for (const [index, record] of invoiceRecords.entries()) {
    subtotal += record.total

    if (y > 245) {
      pdf.addPage()
      y = 20
    }

    const service = `${flowLabel(record.type)}: ${record.productName}`
    const serviceShort = service.length > 44 ? `${service.slice(0, 41)}...` : service

    pdf.text(`${index + 1}.`, cols.pos, y)
    pdf.text(serviceShort, cols.bezeichnung, y)
    pdf.text(formatQty(record.amount), cols.anzahl, y, { align: 'right' })
    pdf.text(record.unit, cols.einheit, y)
    pdf.text(money(record.unitPrice), cols.einzelpreis, y, { align: 'right' })
    pdf.text(money(record.total), cols.gesamtpreis, y, { align: 'right' })

    y += 7
  }

  if (y > 220) {
    pdf.addPage()
    y = 20
  }

  y += 3
  pdf.setDrawColor(0)
  pdf.line(left, y, right, y)
  y += 7

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)

  if (reverseCharge) {
    pdf.text('Gesamtbetrag', cols.pos, y)
    pdf.text(money(subtotal), cols.gesamtpreis, y, { align: 'right' })
    y += 1
    pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

    y += 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9.5)
    pdf.text('Bei den oben genannten Leistungen handelt es sich um eine Bauleistung im Sinne von § 13b UStG', left, y)
    y += 5
    pdf.text('Es liegt eine Steuerschuldnerschaft des Leistungsempfängers vor', left, y)
    y += 9
    pdf.text('Zahlbar innerhalb von 14 Tagen ab Rechnungsstellung', left, y)
  } else {
    const vat = subtotal * 0.19
    const gross = subtotal + vat

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text('Zwischensumme (netto)', cols.pos, y)
    pdf.text(money(subtotal), cols.gesamtpreis, y, { align: 'right' })
    y += 6
    pdf.text('zzgl. 19% USt.', cols.pos, y)
    pdf.text(money(vat), cols.gesamtpreis, y, { align: 'right' })
    y += 7
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Gesamtbetrag', cols.pos, y)
    pdf.text(money(gross), cols.gesamtpreis, y, { align: 'right' })
    y += 1
    pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

    y += 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9.5)
    pdf.text('Zahlbar innerhalb von 14 Tagen ab Rechnungsstellung', left, y)
  }

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    drawCompanyFooter(pdf)
  }

  if (totalPages > 1) {
    pdf.setPage(1)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(metaLabelX, seiteY - 3.5, right - metaLabelX, 5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Seite:', metaLabelX, seiteY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`1 von ${totalPages}`, metaValueX, seiteY, { align: 'right' })
  }

  pdf.save(`rechnung-${toSafeFileDate(invoiceNo)}.pdf`)

  return invoiceNo
}

export function downloadStornoDoc(
  records: RecordItem[],
  companyName: string,
  cancelId: string,
  originalDocId?: string,
) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 12
  const right = 198
  let y = 16

  pdf.setDrawColor(220)
  pdf.setFillColor(254, 242, 242)
  pdf.roundedRect(left, y, 186, 26, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text('STORNORECHNUNG', left + 4, y + 9)
  pdf.setFontSize(11)
  pdf.text('Gaiser Baustoffe', left + 4, y + 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Musterstrasse 1, 10115 Berlin', left + 4, y + 21)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(`Nr.: ${cancelId}`, right - 4, y + 10, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, right - 4, y + 16, { align: 'right' })
  pdf.text(`Positionen: ${records.length}`, right - 4, y + 21, { align: 'right' })

  y += 36

  pdf.setDrawColor(225)
  pdf.roundedRect(left, y, 120, 24, 2, 2)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('Rechnungsadresse', left + 3, y + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(companyName, left + 3, y + 11)
  pdf.text('z. Hd. Buchhaltung', left + 3, y + 21)

  y += 40

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (originalDocId) {
    pdf.text(`Storno zu: ${originalDocId}`, left, y)
    y += 5
  }
  pdf.text(
    `Leistungszeitraum: ${records[0].createdAt} bis ${records[records.length - 1].createdAt}`,
    left,
    y,
  )

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.setFillColor(254, 226, 226)
  pdf.rect(left, y - 4.5, 186, 7.5, 'F')
  pdf.text('Pos.', left, y)
  pdf.text('Datum', 24, y)
  pdf.text('Leistung', 56, y)
  pdf.text('Menge', 132, y)
  pdf.text('EP', 158, y)
  pdf.text('Betrag', right, y, { align: 'right' })

  y += 3
  pdf.setDrawColor(190)
  pdf.line(left, y, right, y)
  y += 7

  let subtotal = 0

  for (const [index, record] of records.entries()) {
    subtotal += record.total

    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    const createdAt = record.createdAt.slice(0, 10)
    const service = `${flowLabel(record.type)}: ${record.productName} (${record.constructionSiteName || '-'})`
    const serviceShort = service.length > 40 ? `${service.slice(0, 37)}...` : service

    pdf.text(String(index + 1), left, y)
    pdf.text(createdAt, 24, y)
    pdf.text(serviceShort, 56, y)
    pdf.text(`${record.amount} ${record.unit}`, 132, y)
    pdf.text(money(record.unitPrice), 158, y)
    pdf.text(`-${money(record.total)}`, right, y, { align: 'right' })

    y += 4
    pdf.setDrawColor(235)
    pdf.line(left, y, right, y)
    y += 6
  }

  const vat = subtotal * 0.19
  const gross = subtotal + vat
  const summaryBoxWidth = 72
  const summaryBoxX = 126
  const summaryTop = 236

  pdf.setDrawColor(220)
  pdf.roundedRect(summaryBoxX, summaryTop, summaryBoxWidth, 24, 2, 2)
  y = summaryTop + 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Zwischensumme (netto):', summaryBoxX + 3, y)
  pdf.text(`-${money(subtotal)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 5
  pdf.text('zzgl. 19% USt.:', summaryBoxX + 3, y)
  pdf.text(`-${money(vat)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Gutschriftsbetrag:', summaryBoxX + 3, y)
  pdf.text(`-${money(gross)}`, summaryBoxX + summaryBoxWidth - 3, y, { align: 'right' })

  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Diese Gutschrift storniert den oben genannten Beleg vollstaendig.', left, y)

  pdf.save(`storno-${toSafeFileDate(cancelId)}.pdf`)
}

export function toSafeFileDate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '-')
}

function drawDeliveryNoteSignatureBlock(pdf: jsPDF, left: number, right: number) {
  const y = 244
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(9.5)
  pdf.setTextColor(0)
  pdf.text('Ware ordnungsgemäß erhalten.', left, y)

  const dashY = y + 12
  pdf.setDrawColor(0)
  pdf.setLineDashPattern([2, 1.5], 0)
  pdf.line(left, dashY, right, dashY)
  pdf.setLineDashPattern([], 0)

  pdf.setFontSize(9)
  pdf.text('Datum', left, dashY + 5)
  pdf.text('Unterschrift', left + 70, dashY + 5)
  pdf.setFont('helvetica', 'normal')
}

export async function downloadCombinedDeliveryNote(
  records: RecordItem[],
  companyName: string,
  deliveryNoteId?: string,
  customer?: InvoiceCustomer,
) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  const right = 195

  const logoDataUrl = await loadLogoDataUrl()
  const date = new Date().toLocaleDateString('de-DE')
  const siteNames = new Set(records.map((r) => r.constructionSiteName || '-'))
  const bauvorhaben = siteNames.size === 1 ? [...siteNames][0] : 'Diverse Baustellen'

  const cols = {
    pos: left,
    bezeichnung: left + 10,
    anzahl: 120,
    einheit: 126,
    einzelpreis: 155,
    gesamtpreis: right,
  }

  const metaLabelX = 122
  const metaLabels = ['Lieferschein-Nr.:', 'Datum:', 'Kunden-Nr.:', 'Seite:']
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  const metaValueX = metaLabelX + Math.max(...metaLabels.map((label) => pdf.getTextWidth(label))) + 3

  function drawPageHeader(isFirstPage: boolean) {
    const addressBottom = drawLetterhead(pdf, left, right, logoDataUrl)

    let addressY = 38 + 7
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(companyName, left, addressY)

    if (customer?.street) {
      addressY += 5
      pdf.text(customer.street, left, addressY)
    }

    const customerPostalCodeAndCity = [customer?.postalCode, customer?.city].filter(Boolean).join(' ')
    if (customerPostalCodeAndCity) {
      addressY += 5
      pdf.text(customerPostalCodeAndCity, left, addressY)
    }

    const metaValues = [deliveryNoteId ?? '', date, customer?.customerNumber ?? '', '']
    let metaY = Math.max(addressBottom, addressY) + 8
    let seiteY = metaY
    for (const [index, label] of metaLabels.entries()) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text(label, metaLabelX, metaY)
      pdf.setFont('helvetica', 'normal')
      pdf.text(metaValues[index], metaValueX, metaY)
      if (label === 'Seite:') seiteY = metaY
      metaY += 5
    }

    let y = metaY + 3
    if (isFirstPage) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text('Lieferschein', left, y)
      y += 9
      pdf.setFontSize(9.5)
      pdf.text('Kunde:', left, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(companyName, left + pdf.getTextWidth('Bauvorhaben:') + 3, y)
      y += 5
      pdf.setFont('helvetica', 'bold')
      pdf.text('Bauvorhaben:', left, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(bauvorhaben, left + pdf.getTextWidth('Bauvorhaben:') + 3, y)
      y += 8
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setFillColor(191, 191, 191)
    pdf.rect(left, y - 4.5, right - left, 6.5, 'F')
    pdf.text('Pos.', cols.pos + 1, y)
    pdf.text('Bezeichnung', cols.bezeichnung, y)
    pdf.text('Anzahl', cols.anzahl, y, { align: 'right' })
    pdf.text('Einheit', cols.einheit, y)
    pdf.text('Einzelpreis', cols.einzelpreis, y, { align: 'right' })
    pdf.text('Gesamtpreis', cols.gesamtpreis, y, { align: 'right' })
    y += 7

    return { tableTop: y, seiteY }
  }

  let { tableTop: y, seiteY } = drawPageHeader(true)
  const seiteYs = [seiteY]

  let total = 0
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)

  for (const [index, record] of records.entries()) {
    if (y > 235) {
      pdf.addPage()
      const header = drawPageHeader(false)
      y = header.tableTop
      seiteYs.push(header.seiteY)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
    }

    total += record.total

    const service = `${flowLabel(record.type)}: ${record.productName}`
    const serviceShort = service.length > 44 ? `${service.slice(0, 41)}...` : service

    pdf.text(`${index + 1}.`, cols.pos, y)
    pdf.text(serviceShort, cols.bezeichnung, y)
    pdf.text(formatQty(record.amount), cols.anzahl, y, { align: 'right' })
    pdf.text(record.unit, cols.einheit, y)
    pdf.text(money(record.unitPrice), cols.einzelpreis, y, { align: 'right' })
    pdf.text(money(record.total), cols.gesamtpreis, y, { align: 'right' })

    y += 7
  }

  if (y > 225) {
    pdf.addPage()
    const header = drawPageHeader(false)
    y = header.tableTop
    seiteYs.push(header.seiteY)
  }

  y += 3
  pdf.setDrawColor(0)
  pdf.line(left, y, right, y)
  y += 7

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Gesamtbetrag', cols.pos, y)
  pdf.text(money(total), cols.gesamtpreis, y, { align: 'right' })
  y += 1
  pdf.line(cols.einzelpreis, y, cols.gesamtpreis, y)

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    if (page === 1) drawDeliveryNoteSignatureBlock(pdf, left, right)
    drawCompanyFooter(pdf)
  }

  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(metaValueX - 1, seiteYs[page - 1] - 3.5, right - metaValueX + 1, 5, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`${page} von ${totalPages}`, metaValueX, seiteYs[page - 1])
  }

  const fileName = deliveryNoteId
    ? `lieferschein-${toSafeFileDate(deliveryNoteId)}.pdf`
    : `lieferschein-sammel-${toSafeFileDate(new Date().toLocaleString('de-DE'))}.pdf`
  pdf.save(fileName)
}
