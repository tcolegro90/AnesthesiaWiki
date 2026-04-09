(function() {
  function uniqSorted(arr) {
    return Array.from(new Set(arr)).sort(function(a, b) {
      return a.localeCompare(b);
    });
  }

  var anesthesiaCategories = {
    inductionAgents: [
      'Propofol', 'Etomidate', 'Ketamine', 'Methohexital', 'Dexmedetomidine', 'Midazolam'
    ],
    opioids: [
      'Fentanyl', 'Sufentanil', 'Remifentanil', 'Morphine', 'Hydromorphone'
    ],
    nonOpioidAnalgesics: [
      'Acetaminophen', 'Ketorolac', 'Ibuprofen'
    ],
    inhaledAnesthetics: [
      'Sevoflurane', 'Isoflurane', 'Desflurane', 'Nitrous Oxide'
    ],
    localAnesthetics: [
      'Lidocaine', 'Bupivacaine', 'Ropivacaine', 'Mepivacaine', 'Chloroprocaine', 'Tetracaine'
    ],
    paralytics: [
      'Rocuronium', 'Succinylcholine', 'Vecuronium', 'Cisatracurium', 'Atracurium', 'Mivacurium'
    ],
    reversal: [
      'Sugammadex', 'Neostigmine', 'Edrophonium', 'Glycopyrrolate'
    ],
    antiemetics: [
      'Ondansetron', 'Dexamethasone', 'Droperidol', 'Aprepitant', 'Scopolamine', 'Metoclopramide'
    ],
    antihypertensives: [
      'Labetalol', 'Esmolol', 'Hydralazine', 'Nicardipine', 'Nitroglycerin', 'Sodium Nitroprusside'
    ],
    antiarrhythmics: [
      'Adenosine', 'Amiodarone', 'Lidocaine', 'Esmolol', 'Verapamil'
    ],
    vasoactive: [
      'Phenylephrine', 'Ephedrine', 'Epinephrine', 'Norepinephrine', 'Vasopressin', 'Dopamine', 'Dobutamine'
    ],
    crisisManagement: [
      'Dantrolene', 'Calcium Chloride', 'Calcium Gluconate', 'Sodium Bicarbonate', 'Insulin', 'Dextrose'
    ]
  };

  var homeMeds = [
    'Acetaminophen', 'Acyclovir', 'Albuterol', 'Allopurinol', 'Alprazolam', 'Amlodipine', 'Amiodarone',
    'Amitriptyline', 'Amoxicillin', 'Apixaban', 'Aripiprazole', 'Aspirin', 'Atorvastatin', 'Azithromycin',
    'Baclofen', 'Benazepril', 'Benzonatate', 'Bisoprolol', 'Brimonidine', 'Budesonide', 'Budesonide/Formoterol',
    'Bupropion', 'Buspirone', 'Calcium Carbonate', 'Canagliflozin', 'Carbamazepine', 'Carvedilol', 'Celecoxib',
    'Cephalexin', 'Cetirizine', 'Chlorthalidone', 'Citalopram', 'Clindamycin', 'Clonazepam', 'Clonidine',
    'Clopidogrel', 'Cyclobenzaprine', 'Dapagliflozin', 'Dexamethasone', 'Diazepam', 'Diclofenac', 'Digoxin',
    'Diltiazem', 'Diphenhydramine', 'Donepezil', 'Doxycycline', 'Dulaglutide', 'Duloxetine', 'Edoxaban',
    'Empagliflozin', 'Enalapril', 'Escitalopram', 'Esomeprazole', 'Estradiol', 'Ezetimibe', 'Famotidine',
    'Fenofibrate', 'Ferrous Sulfate', 'Finasteride', 'Fluconazole', 'Fluoxetine', 'Fluticasone', 'Folic Acid',
    'Furosemide', 'Gabapentin', 'Glimepiride', 'Glipizide', 'Hydralazine', 'Hydrochlorothiazide',
    'Hydroxychloroquine', 'Hydroxyzine', 'Ibuprofen', 'Insulin Aspart', 'Insulin Degludec', 'Insulin Detemir',
    'Insulin Glargine', 'Insulin Lispro', 'Ipratropium', 'Irbesartan', 'Isosorbide Mononitrate', 'Ketorolac',
    'Labetalol', 'Lactulose', 'Lamotrigine', 'Lansoprazole', 'Levetiracetam', 'Levothyroxine', 'Lidocaine Patch',
    'Linaclotide', 'Liraglutide', 'Lisinopril', 'Lithium', 'Loperamide', 'Loratadine', 'Lorazepam', 'Losartan',
    'Lovastatin', 'Meloxicam', 'Memantine', 'Metformin', 'Methimazole', 'Methocarbamol', 'Methylphenidate',
    'Metoclopramide', 'Metoprolol', 'Metronidazole', 'Mirtazapine', 'Montelukast', 'Morphine', 'Naproxen',
    'Nebivolol', 'Nifedipine', 'Nitrofurantoin', 'Nitroglycerin', 'Nortriptyline', 'Olanzapine', 'Omeprazole',
    'Ondansetron', 'Oxybutynin', 'Oxycodone', 'Pantoprazole', 'Paroxetine', 'Phenazopyridine', 'Phenobarbital',
    'Phenytoin', 'Pioglitazone', 'Potassium Chloride', 'Pramipexole', 'Pravastatin', 'Prednisone', 'Pregabalin',
    'Propranolol', 'Quetiapine', 'Rivaroxaban', 'Ropinirole', 'Rosuvastatin', 'Sacubitril/Valsartan', 'Senna',
    'Sertraline', 'Sitagliptin', 'Spironolactone', 'Sucralfate', 'Sulfasalazine', 'Sumatriptan', 'Tamsulosin',
    'Temazepam', 'Terbinafine', 'Torsemide', 'Tramadol', 'Trazodone', 'Valsartan', 'Vancomycin', 'Venlafaxine',
    'Verapamil', 'Warfarin', 'Zolpidem'
  ];

  window.MED_CATALOG = {
    categories: anesthesiaCategories,
    anesthesiaMeds: uniqSorted(
      Object.keys(anesthesiaCategories).reduce(function(acc, key) {
        return acc.concat(anesthesiaCategories[key]);
      }, [])
    ),
    homeMeds: uniqSorted(homeMeds),
    prescribedMeds: uniqSorted(homeMeds)
  };
})();
