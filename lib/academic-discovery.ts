export function buildAcademicQueries(name:string){
  const clean=name.trim();
  const parts=clean.split(/\s+/).filter(Boolean);
  const reversed=parts.length>1?[...parts].reverse().join(" "):clean;

  return [...new Set([
    '"'+clean+'" université',
    '"'+reversed+'" université',
    '"'+clean+'" étudiant',
    '"'+reversed+'" étudiant',
    '"'+clean+'" "année universitaire"',
    '"'+reversed+'" "année universitaire"',
    '"'+clean+'" filière',
    '"'+reversed+'" filière',
    '"'+clean+'" semestre',
    '"'+reversed+'" semestre',
    '"'+clean+'" apogee',
    '"'+reversed+'" apogee',
    'site:scribd.com "'+reversed+'"',
    'site:fichier-pdf.fr "'+reversed+'"',
    'filetype:pdf "'+reversed+'" université',
    '"'+clean+'" ESB'
  ])];
}
