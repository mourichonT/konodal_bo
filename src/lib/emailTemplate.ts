import logoVertical from "@/assets/logo-vertical.png?url&no-inline"
import logoHorizontalBlack from "@/assets/logo-horizontal-black.png?url&no-inline"

// Gabarit commun de tous les mails envoyés depuis le BO : bandeau vert
// #48775B avec logo et titre, corps, pied de page gris (logo noir,
// Instagram, LinkedIn). Même gabarit côté functions_python
// (_konodal_email_html, main.py) - garder les deux alignés.

export const APP_URL = "https://app.konodal.com"
export const KIT_URL = "https://konodal.com/kit"
const LINKEDIN_URL = "https://www.linkedin.com/company/konodal/"
const INSTAGRAM_URL = "https://www.instagram.com/konodal_fr/"
const CONTACT_EMAIL = "contact@konodal.com"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Texte saisi (message libre, motif de refus) : échappé, un paragraphe par
// bloc séparé d'une ligne vide, retours à la ligne conservés.
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n")
}

export function emailButtonHtml(href: string, label: string): string {
  return `
        <div style="margin: 30px 0; text-align: center;">
            <a href="${href}" style="background-color: #48775B; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">
                ${label}
            </a>
        </div>`
}

export const emailContactHtml = `
        <p style="font-size: 12px; color: #666; text-align: center;">
            Pour toute question, répondez simplement à cet email ou écrivez-nous à
            <a href="mailto:${CONTACT_EMAIL}" style="color: #48775B; font-size: 12px;">${CONTACT_EMAIL}</a>
        </p>`

export function konodalEmailHtml({ title, bodyHtml }: { title: string; bodyHtml: string }): string {
  const logoUrl = new URL(logoVertical, window.location.origin).href
  const footerLogoUrl = new URL(logoHorizontalBlack, window.location.origin).href
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
    <meta charset="UTF-8">
    <title>KONODAL - ${escapeHtml(title)}</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table align="center" width="600" style="background-color: #ffffff; border-collapse: collapse; margin-top: 20px;">
        <tr>
        <td style="background-color: rgba(72, 119, 91, 1); color: rgba(255, 255, 255, 1); text-align: center; padding: 30px 20px">
            <img src="${logoUrl}" alt="KONODAL-Logo" width="90" style="max-width: 25%">
            <h2 style="margin: 30px 0 0; font-size: 20px">${escapeHtml(title)}</h2>
        </td>
        </tr>

        <tr>
        <td style="padding: 20px 30px; color: #333333;">
            ${bodyHtml}
        </td>
        </tr>

        <tr>
        <td style="background-color: #e0e0e0; text-align: center; padding: 20px;">
            <img src="${footerLogoUrl}" alt="KONODAL" width="140" style="margin: 10px 0;">
            <div style="margin: 10px 0;">
            <a href="${INSTAGRAM_URL}"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram" style="margin: 0 5px;"></a>
            <a href="${LINKEDIN_URL}"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111532.png" alt="LinkedIn" style="margin: 0 5px;"></a>
            </div>
            <p style="font-size: 12px; color: #777;">Copyright © 2026</p>
        </td>
        </tr>
    </table>
    </body>
    </html>
  `
}
