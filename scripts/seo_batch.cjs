const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'public');
const files = fs.readdirSync(root).filter((name) => {
    return /^horaires-ligne-.*\.html$/.test(name) && !/^horaires-ligne-[abcd]\.html$/.test(name);
});

const ldPattern = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
const kwPattern = /<meta name="keywords" content="[^"]*">/;
const themePattern = /<meta name="theme-color" content="[^"]*">/;
const applePattern = /<meta name="apple-mobile-web-app-title" content="[^"]*">/;
const lineColorPattern = /--line-color:\s*(#[0-9A-Fa-f]{3,6})/;

files.forEach((filename) => {
    const filePath = path.join(root, filename);
    let text = fs.readFileSync(filePath, 'utf8');
    const lineLower = filename.match(/horaires-ligne-([^.]+)\.html/)[1];
    const lineDisplay = lineLower.toUpperCase();
    const colorMatch = text.match(lineColorPattern);
    const lineColor = colorMatch ? colorMatch[1] : '#22c55e';

    const ld = `
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": "https://www.xn--primap-bva.fr/horaires-ligne-${lineLower}.html",
                "url": "https://www.xn--primap-bva.fr/horaires-ligne-${lineLower}.html",
                "name": "Ligne ${lineDisplay} Péribus — Horaires Bus Périgueux",
                "description": "Horaires ligne ${lineDisplay} Péribus : prochains passages en temps réel et fiche PDF.",
                "inLanguage": "fr-FR",
                "isPartOf": { "@id": "https://www.xn--primap-bva.fr/#website" },
                "about": { "@id": "https://www.xn--primap-bva.fr/horaires-ligne-${lineLower}.html#busroute" },
                "breadcrumb": {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.xn--primap-bva.fr/" },
                        { "@type": "ListItem", "position": 2, "name": "Horaires Péribus", "item": "https://www.xn--primap-bva.fr/horaires.html" },
                        { "@type": "ListItem", "position": 3, "name": "Ligne ${lineDisplay}" }
                    ]
                }
            },
            {
                "@type": "BusRoute",
                "@id": "https://www.xn--primap-bva.fr/horaires-ligne-${lineLower}.html#busroute",
                "name": "Ligne ${lineDisplay} Péribus",
                "description": "Ligne ${lineDisplay} du réseau Péribus dans le Grand Périgueux, horaires et arrêts à jour.",
                "url": "https://www.xn--primap-bva.fr/horaires-ligne-${lineLower}.html",
                "provider": {
                    "@type": "Organization",
                    "name": "Péribus",
                    "url": "https://www.grandperigueux.fr/Annuaire-des-transports/Peribus"
                },
                "areaServed": {
                    "@type": "City",
                    "name": "Périgueux",
                    "containedInPlace": {
                        "@type": "AdministrativeArea",
                        "name": "Dordogne, Nouvelle-Aquitaine, France"
                    }
                }
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "Quels sont les horaires de la ligne ${lineDisplay} Péribus ?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Consultez les horaires en temps réel et la fiche PDF de la ligne ${lineDisplay} Péribus directement sur PériMap."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Quels arrêts dessert la ligne ${lineDisplay} Péribus ?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Retrouvez la liste des arrêts et l'itinéraire complet de la ligne ${lineDisplay} dans la page horaires et la fiche PDF associée."
                        }
                    }
                ]
            }
        ]
    }
    </script>
`;

    const keywords = `    <meta name="keywords" content="ligne ${lineDisplay} péribus, horaires ligne ${lineDisplay} péribus, bus ligne ${lineDisplay} Périgueux, arrêts ligne ${lineDisplay}, péribus ${lineDisplay}, transport Grand Périgueux, horaires péribus 2026, bus Périgueux temps réel">`;

    text = text.replace(ldPattern, ld);
    text = text.replace(kwPattern, keywords);
    text = text.replace(themePattern, `    <meta name="theme-color" content="${lineColor}">`);
    text = text.replace(applePattern, `    <meta name="apple-mobile-web-app-title" content="Ligne ${lineDisplay} Péribus">`);

    fs.writeFileSync(filePath, text, 'utf8');
    console.log('updated', filename);
});
