export function buildAcademicQueries(name:string){
  const clean=name.trim();
  const parts=clean.split(/\s+/).filter(Boolean);
  const reversed=parts.length>1?[...parts].reverse().join(" "):clean;

  return [...new Set([
    '"'+clean+'" PDF',
    '"'+reversed+'" PDF',
    '"'+clean+'" étudiant',
    '"'+reversed+'" étudiant',
    '"'+clean+'" inscription',
    '"'+reversed+'" inscription',
    '"'+clean+'" université',
    '"'+reversed+'" université',
    'site:scribd.com "'+clean+'"',
    'site:scribd.com "'+reversed+'"',
    'filetype:pdf "'+clean+'"',
    'filetype:pdf "'+reversed+'"',
    '"'+clean+'" "année universitaire"',
    '"'+reversed+'" "année universitaire"',
    '"'+clean+'" filière',
    '"'+reversed+'" filière',
    '"'+clean+'" semestre',
    '"'+reversed+'" semestre',
    '"'+clean+'" apogee',
    '"'+reversed+'" apogee',
    'site:fichier-pdf.fr "'+clean+'"',
    'site:fichier-pdf.fr "'+reversed+'"'
  ])];
}
