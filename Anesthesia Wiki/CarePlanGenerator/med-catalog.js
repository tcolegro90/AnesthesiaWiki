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

  // 320 most commonly prescribed home/patient medications
  var homeMeds = [
    'Acamprosate', 'Acarbose', 'Acebutolol', 'Acetaminophen', 'Acyclovir',
    'Adalimumab', 'Alendronate', 'Alfuzosin', 'Alirocumab', 'Aliskiren',
    'Allopurinol', 'Almotriptan', 'Alogliptin', 'Alprazolam', 'Amantadine',
    'Amiloride', 'Aminophylline', 'Amitriptyline', 'Amlodipine', 'Amoxicillin',
    'Amoxicillin-Clavulanate', 'Amphetamine', 'Anagrelide', 'Anakinra', 'Anastrozole',
    'Apixaban', 'Aripiprazole', 'Aspirin', 'Atenolol', 'Atomoxetine',
    'Atorvastatin', 'Atovaquone', 'Azathioprine', 'Azelastine', 'Azilsartan',
    'Azithromycin', 'Baclofen', 'Balsalazide', 'Beclomethasone', 'Benazepril',
    'Benzonatate', 'Benztropine', 'Betamethasone', 'Bisacodyl', 'Bisoprolol',
    'Bosentan', 'Brexpiprazole', 'Brimonidine', 'Budesonide', 'Budesonide-Formoterol',
    'Bumetanide', 'Buprenorphine', 'Bupropion', 'Buspirone', 'Cabergoline',
    'Calcium Carbonate', 'Calcium Citrate', 'Canagliflozin', 'Candesartan', 'Captopril',
    'Carbamazepine', 'Carbidopa-Levodopa', 'Cariprazine', 'Carvedilol', 'Cefdinir',
    'Cefuroxime', 'Celecoxib', 'Cephalexin', 'Cetirizine', 'Chlorthalidone',
    'Ciclesonide', 'Ciprofloxacin', 'Citalopram', 'Clarithromycin', 'Clindamycin',
    'Clobetasol', 'Clonazepam', 'Clonidine', 'Clopidogrel', 'Clozapine',
    'Colchicine', 'Colesevelam', 'Colestipol', 'Cyanocobalamin', 'Cyclobenzaprine',
    'Dabigatran', 'Dapagliflozin', 'Darifenacin', 'Denosumab', 'Desmopressin',
    'Desvenlafaxine', 'Dexlansoprazole', 'Dextroamphetamine', 'Diazepam', 'Diclofenac',
    'Dicyclomine', 'Digoxin', 'Diltiazem', 'Diphenhydramine', 'Docusate',
    'Donepezil', 'Doxazosin', 'Doxycycline', 'Dulaglutide', 'Duloxetine',
    'Dutasteride', 'Edoxaban', 'Eletriptan', 'Empagliflozin', 'Enalapril',
    'Entacapone', 'Eplerenone', 'Eprosartan', 'Erythromycin', 'Escitalopram',
    'Esomeprazole', 'Estradiol', 'Etanercept', 'Ethambutol', 'Ethosuximide',
    'Evolocumab', 'Ezetimibe', 'Famciclovir', 'Famotidine', 'Febuxostat',
    'Felodipine', 'Fenofibrate', 'Ferrous Gluconate', 'Ferrous Sulfate', 'Fexofenadine',
    'Finasteride', 'Flecainide', 'Fluconazole', 'Fluoxetine', 'Fluticasone',
    'Fluvastatin', 'Fluvoxamine', 'Folic Acid', 'Fosinopril', 'Frovatriptan',
    'Furosemide', 'Gabapentin', 'Galantamine', 'Gemfibrozil', 'Glimepiride',
    'Glipizide', 'Glyburide', 'Guanfacine', 'Haloperidol', 'Hydrochlorothiazide',
    'Hydrocodone', 'Hydrocortisone', 'Hydroxychloroquine', 'Hydroxyzine', 'Ibandronate',
    'Indapamide', 'Indomethacin', 'Insulin Aspart', 'Insulin Degludec', 'Insulin Detemir',
    'Insulin Glargine', 'Insulin Glulisine', 'Insulin Lispro', 'Insulin NPH', 'Ipratropium',
    'Irbesartan', 'Isoniazid', 'Isosorbide Dinitrate', 'Isosorbide Mononitrate', 'Itraconazole',
    'Lactulose', 'Lamotrigine', 'Lansoprazole', 'Latanoprost', 'Leflunomide',
    'Levetiracetam', 'Levocetirizine', 'Levofloxacin', 'Levonorgestrel', 'Levothyroxine',
    'Linaclotide', 'Linagliptin', 'Liraglutide', 'Lisdexamfetamine', 'Lisinopril',
    'Lithium', 'Loperamide', 'Loratadine', 'Lorazepam', 'Losartan',
    'Lovastatin', 'Lubiprostone', 'Lurasidone', 'Magnesium Oxide', 'Medroxyprogesterone',
    'Meloxicam', 'Memantine', 'Mesalamine', 'Metformin', 'Methimazole',
    'Methocarbamol', 'Methylphenidate', 'Methylprednisolone', 'Metoprolol', 'Metronidazole',
    'Mexiletine', 'Midodrine', 'Miglitol', 'Milnacipran', 'Minocycline',
    'Mirabegron', 'Mirtazapine', 'Modafinil', 'Montelukast', 'Moxifloxacin',
    'Naproxen', 'Naratriptan', 'Nateglinide', 'Nebivolol', 'Niacin',
    'Nifedipine', 'Nisoldipine', 'Nitrofurantoin', 'Norethindrone', 'Nortriptyline',
    'Olanzapine', 'Olmesartan', 'Omega-3 Fatty Acids', 'Omeprazole', 'Oxazepam',
    'Oxcarbazepine', 'Oxybutynin', 'Oxycodone', 'Pantoprazole', 'Paroxetine',
    'Penicillin', 'Phenazopyridine', 'Phenobarbital', 'Phenytoin', 'Pioglitazone',
    'Pitavastatin', 'Plecanatide', 'Potassium Chloride', 'Pramipexole', 'Prasugrel',
    'Pravastatin', 'Prednisone', 'Pregabalin', 'Progesterone', 'Propafenone',
    'Propranolol', 'Propylthiouracil', 'Psyllium', 'Pyridostigmine', 'Quetiapine',
    'Quinapril', 'Rabeprazole', 'Ramipril', 'Ranolazine', 'Rasagiline',
    'Repaglinide', 'Rifampin', 'Rifaximin', 'Riluzole', 'Risedronate',
    'Risperidone', 'Rivaroxaban', 'Rivastigmine', 'Rizatriptan', 'Roflumilast',
    'Ropinirole', 'Rosuvastatin', 'Sacubitril-Valsartan', 'Salmeterol', 'Saxagliptin',
    'Selegiline', 'Semaglutide', 'Senna', 'Sertraline', 'Sildenafil',
    'Simvastatin', 'Sitagliptin', 'Solifenacin', 'Sotalol', 'Spironolactone',
    'Sucralfate', 'Sulfasalazine', 'Sumatriptan', 'Tadalafil', 'Tamsulosin',
    'Telmisartan', 'Temazepam', 'Terazosin', 'Terbinafine', 'Teriparatide',
    'Testosterone', 'Theophylline', 'Ticagrelor', 'Tiotropium', 'Tolterodine',
    'Topiramate', 'Torsemide', 'Tramadol', 'Trandolapril', 'Trazodone',
    'Tretinoin', 'Triamterene', 'Trimethoprim-Sulfamethoxazole', 'Valacyclovir', 'Valproate',
    'Valsartan', 'Vardenafil', 'Venlafaxine', 'Vitamin D3', 'Warfarin',
    'Zafirlukast', 'Zileuton', 'Ziprasidone', 'Zolmitriptan', 'Zolpidem'
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
