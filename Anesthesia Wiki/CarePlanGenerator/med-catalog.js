(function() {
  window.MED_CATALOG = {
    categories: {
      inductionAgents: [
        'Propofol',
        'Etomidate',
        'Ketamine',
        'Dexmedetomidine',
        'Methohexital',
        'Midazolam',
      ],
      opioids: [
        'Fentanyl'
      ],
      nonOpioidAnalgesics: [
        'Acetaminophen',
        'Ketorolac'
      ],
      inhaledAnesthetics: [
        'Sevoflurane',
        'Isoflurane',
        'Desflurane',
        'Nitrous Oxide',
      ],
      localAnesthetics: [
        'Bupivacaine',
        'Chloroprocaine',
        'Lidocaine',
        'Mepivacaine',
        'Ropivacaine',
        'Tetracaine'
      ],
      paralytics: [
        'Rocuronium',
        'Succinylcholine',
        'Atracurium',
        'Cisatracurium',
        'Mivacurium',
        'Vecuronium'
      ],
      reversal: [
        'Edrophonium',
        'Neostigmine',
        'Sugammadex'
      ],
      antiemetics: [
        'Ondansetron',
        'Dexamethasone',
        'Droperidol',
        'Aprepitant',
        'Propofol',
        'Scopolamine'
      ],
      antihypertensives: [
        'Atenolol',
        'Carvedilol',
        'Enalapril',
        'Enalaprilat',
        'Hydralazine',
        'Labetalol',
        'Lisinopril',
        'Losartan',
        'Metoprolol',
        'Nicardipine',
        'Nitroglycerin',
        'Propranolol',
        'Sodium Nitroprusside',
        'Valsartan'
      ],
      antiarrhythmics: [
        'Adenosine',
        'Amiodarone',
        'Esmolol',
        'Lidocaine (Antiarrhythmic)',
        'Verapamil'
      ],
      vasoactive: [
        'Dopamine',
        'Ephedrine',
        'Epinephrine',
        'Norepinephrine',
        'Phenylephrine',
        'Vasopressin'
      ],
      crisisManagement: [
        'Dantrolene'
      ]
    }
  };

  function uniqSorted(arr) {
    return Array.from(new Set(arr)).sort(function(a, b) {
      return a.localeCompare(b);
    });
  }

  var c = window.MED_CATALOG.categories;
  window.MED_CATALOG.prescribedMeds = uniqSorted(
    c.inductionAgents
      .concat(c.opioids)
      .concat(c.nonOpioidAnalgesics)
      .concat(c.inhaledAnesthetics)
      .concat(c.localAnesthetics)
      .concat(c.paralytics)
      .concat(c.reversal)
      .concat(c.antiemetics)
      .concat(c.antihypertensives)
      .concat(c.antiarrhythmics)
      .concat(c.vasoactive)
      .concat(c.crisisManagement)
  );
})();
