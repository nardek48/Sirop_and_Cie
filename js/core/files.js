/**
 * files.js — télécharger et ouvrir des fichiers depuis le navigateur.
 * Utilisé par la sauvegarde (mairie), le Mode architecte et l'éditeur de quêtes.
 */
export const Files = {
  /**
   * Fait télécharger un fichier texte.
   * @param {string} name nom proposé
   * @param {string} text contenu
   * @param {string} [type]
   */
  download(name, text, type = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },

  /**
   * Ouvre le sélecteur de fichiers et lit le fichier choisi.
   * @param {string} [accept]
   * @returns {Promise<{name:string, text:string}|null>} null si rien n'a été choisi
   */
  pick(accept = '.json,application/json') {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.hidden = true;
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        input.remove();
        if (!f) return resolve(null);
        // Une sauvegarde fait quelques dizaines de Ko : au-delà de 5 Mo, ce n'en est pas une
        if (f.size > 5e6) return resolve({ name: f.name, text: '' });
        resolve({ name: f.name, text: await f.text() });
      }, { once: true });
      document.body.append(input);
      input.click();
    });
  },

  /** Nom de fichier sans caractères gênants : « Sirotin l'as » → « Sirotin-l-as » */
  slug: str => String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'partie',

  /** 2026-09-28 */
  today: () => new Date().toISOString().slice(0, 10),
};
