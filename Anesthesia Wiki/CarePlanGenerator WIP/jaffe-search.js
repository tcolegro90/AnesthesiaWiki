// Jaffe 6th Edition Anesthesia Textbook Surgery Database
const JAFFE_SURGERIES = [
  // 1.1 Intracranial Neurosurgery
  { name: "Craniotomy for intracranial aneurysms", page: 61 },
  { name: "Craniotomy for cerebral embolectomy", page: 89 },
  { name: "Craniotomy for intracranial vascular malformations", page: 92 },
  { name: "Craniotomy for extracranial-intracranial revascularization (EC-IC bypass)", page: 105 },
  { name: "Craniotomy for tumor", page: 118 },
  { name: "Considerations for awake craniotomy", page: 131 },
  { name: "Craniotomy for skull tumor", page: 135 },
  { name: "Craniotomy for trauma", page: 137 },
  { name: "Microvascular decompression of cranial nerve", page: 151 },
  { name: "Bifrontal craniotomy for CSF leak", page: 159 },
  { name: "Transoral or transnasal approach to cervicomedullary junction and odontoid", page: 163 },
  { name: "Transsphenoidal resection of pituitary tumor", page: 169 },
  { name: "Ventricular shunt procedures", page: 178 },
  { name: "Craniocervical decompression (Chiari malformation)", page: 186 },
  { name: "Stereotactic neurosurgery", page: 189 },
  // 1.2 Functional Neurosurgery
  { name: "Stereotactic procedures: deep brain stimulation, pallidotomy, thalamotomy", page: 200 },
  { name: "Surgical analgesics: spinal cord stimulation, intrathecal pumps, cortical stimulation", page: 208 },
  { name: "Vagus nerve stimulation", page: 216 },
  { name: "Epilepsy surgery", page: 223 },
  { name: "Surgery for spasticity", page: 233 },
  { name: "Percutaneous procedures for trigeminal neuralgia", page: 235 },
  // 1.3 Spinal Neurosurgery
  { name: "Anterior fusion/fixation upper cervical (C1-C2) spine", page: 251 },
  { name: "Posterior fusion/fixation upper cervical spine", page: 255 },
  { name: "Anterior fusion/fixation mid and lower cervical spine", page: 261 },
  { name: "Posterior fusion/fixation mid and lower cervical spine", page: 266 },
  { name: "Anterior cervicothoracic spine surgery", page: 273 },
  { name: "Anterior thoracic spine surgery", page: 291 },
  { name: "Posterior thoracic spine surgery", page: 295 },
  { name: "Anterior lumbar/lumbosacral spine surgery", page: 299 },
  { name: "Posterior lumbar spine surgery", page: 304 },
  { name: "Posterior lumbar fusion and instrumentation", page: 307 },
  // 1.4 Carotid Endarterectomy
  { name: "Carotid endarterectomy", page: 324 },
  // 2.0 Ophthalmic Surgery
  { name: "Cataract extraction with intraocular lens insertion", page: 344 },
  { name: "Corneal transplant", page: 348 },
  { name: "Trabeculectomy", page: 351 },
  { name: "Ectropion repair", page: 356 },
  { name: "Entropion repair", page: 358 },
  { name: "Ptosis repair", page: 360 },
  { name: "Eyelid reconstruction", page: 363 },
  { name: "Pterygium excision", page: 365 },
  { name: "Repair of ruptured or lacerated globe", page: 377 },
  { name: "Dacryocystorhinostomy (DCR)", page: 383 },
  { name: "Enucleation", page: 388 },
  { name: "Orbitotomy—anterior and lateral", page: 391 },
  { name: "Retinal surgery", page: 394 },
  // 3.0 Otolaryngology—Head and Neck Surgery
  { name: "Laryngoscopy/bronchoscopy/esophagoscopy", page: 415 },
  { name: "Tracheotomy/tracheostomy and cricothyroidotomy", page: 432 },
  { name: "Intubation for epiglottitis", page: 440 },
  { name: "Zenker's diverticulectomy (open approach)", page: 443 },
  { name: "Laryngeal framework surgery (thyroplasty, arytenoid adduction, injection laryngoplasty)", page: 446 },
  { name: "Tracheal and cricotracheal resection", page: 453 },
  { name: "Laryngectomy: partial and total", page: 457 },
  { name: "Tonsillectomy and/or adenoidectomy", page: 466 },
  { name: "Glossectomy", page: 476 },
  { name: "Maxillectomy and orbit exenteration", page: 485 },
  { name: "Composite resection with marginal/segmental mandibulectomy (and neck dissection)", page: 492 },
  { name: "Neck dissection", page: 493 },
  { name: "Lymph node biopsy", page: 503 },
  { name: "Parotidectomy: superficial, total, or radical", page: 505 },
  { name: "Submandibular gland excision", page: 509 },
  { name: "Endoscopic sinus surgery", page: 515 },
  { name: "External sinus surgery", page: 526 },
  { name: "Nasal surgery (rhinoplasty, septoplasty, septorhinoplasty)", page: 530 },
  { name: "Facial plastic surgery", page: 531 },
  { name: "Otology and neurotology", page: 543 },
  { name: "Neurotological skull base surgery", page: 553 },
  { name: "Reconstructive surgery for sleep-disordered breathing", page: 569 },
  // 4.0 Dental Surgery
  { name: "Temporomandibular joint arthroscopy/arthrotomy", page: 595 },
  { name: "Oral surgery", page: 598 },
  { name: "Restorative dentistry", page: 600 },
  // 5.0 Thoracic Surgery
  { name: "Lobectomy, pneumonectomy", page: 620 },
  { name: "Wedge resection of lung lesion", page: 620 },
  { name: "Chest-wall resection", page: 639 },
  { name: "Repair of pectus excavatum or carinatum", page: 641 },
  { name: "Thoracoplasty", page: 648 },
  { name: "Drainage of empyema", page: 652 },
  { name: "Tracheal resection", page: 659 },
  { name: "Excision of mediastinal tumor", page: 729 },
  { name: "Mediastinoscopy", page: 732 },
  { name: "Endobronchial ultrasound-guided transbronchial needle aspiration", page: 697 },
  { name: "Bronchoscopy—flexible and rigid", page: 706 },
  { name: "Airway laser surgery", page: 716 },
  { name: "VATS (video-assisted thoracoscopic surgery)", page: 613 },
  { name: "Thymectomy", page: 721 },
  { name: "Excision of blebs or bullae", page: 674 },
  { name: "Lung-volume reduction surgery", page: 681 },
  { name: "Bronchopulmonary lavage", page: 690 },
  { name: "Lung transplant", page: 745 },
  // 6.1 Cardiac Surgery
  { name: "Cardiopulmonary bypass", page: 748 },
  { name: "Coronary artery bypass graft surgery (CABG)", page: 760 },
  { name: "Left ventricular aneurysmectomy", page: 773 },
  { name: "Aortic valve replacement", page: 775 },
  { name: "Mitral valve repair or replacement", page: 785 },
  { name: "Tricuspid valve repair", page: 795 },
  { name: "Septal myectomy/myotomy", page: 803 },
  { name: "Pacemaker insertion", page: 810 },
  { name: "Pericardiectomy", page: 817 },
  // 6.2 Minimally Invasive Cardiac Surgery
  { name: "Off-pump and minimally invasive CABG", page: 827 },
  { name: "Port-access coronary revascularization", page: 839 },
  { name: "Limited thoracotomy and port-access approaches to valve surgery", page: 846 },
  { name: "Transcatheter valve replacement procedures", page: 850 },
  // 6.3 Vascular Surgery
  { name: "Carotid endarterectomy (vascular)", page: 871 },
  { name: "Repair of thoracic aortic aneurysms", page: 876 },
  { name: "Endovascular stent-grafting of aortic aneurysms", page: 885 },
  { name: "Repair of acute aortic dissections", page: 896 },
  { name: "Repair of aneurysms of thoracoabdominal aorta", page: 913 },
  { name: "Surgery of the abdominal aorta", page: 926 },
  { name: "Infrainguinal bypass", page: 939 },
  { name: "Arterial embolectomy", page: 947 },
  { name: "Lumbar sympathectomy", page: 949 },
  { name: "Venous surgery—thrombectomy or vein excision", page: 954 },
  { name: "Surgery for portal hypertension", page: 958 },
  { name: "Arteriovenous access for hemodialysis", page: 971 },
  { name: "Permanent vascular access", page: 975 },
  { name: "Venous surgery—vein stripping and perforator ligation", page: 982 },
  { name: "Varicose vein stripping and ablation", page: 985 },
  // 6.4 Heart/Lung Transplantation
  { name: "Surgery for heart transplantation", page: 992 },
  { name: "Surgery for lung and heart/lung transplantation", page: 1007 },
  // 7.1 Esophageal Surgery
  { name: "Esophagostomy", page: 1031 },
  { name: "Esophageal diverticulectomy", page: 1034 },
  { name: "Management of esophageal perforation", page: 1040 },
  { name: "Esophagomyotomy", page: 1043 },
  { name: "Esophagogastric fundoplasty", page: 1046 },
  { name: "Esophagectomy", page: 1049 },
  // 7.2 Stomach Surgery
  { name: "Gastric resections", page: 1064 },
  { name: "Gastric or duodenal perforation", page: 1069 },
  { name: "Operations for peptic ulcer disease", page: 1064 },
  { name: "Open operations for morbid obesity", page: 1077 },
  { name: "Gastrostomy placement", page: 1089 },
  // 7.3 Intestinal Surgery
  { name: "Duodenotomy", page: 1093 },
  { name: "Open appendectomy", page: 1095 },
  { name: "Excision of Meckel's diverticulum", page: 1098 },
  { name: "Enterostomy", page: 1103 },
  { name: "Continent ileostomy pouch (Kock)", page: 1108 },
  // 7.4 Colorectal Surgery
  { name: "Enhanced recovery after surgery (ERAS)", page: 1124 },
  { name: "Laparoscopic colorectal surgery", page: 1125 },
  { name: "Total proctocolectomy", page: 1127 },
  { name: "Segmental (partial) colectomy", page: 1133 },
  { name: "Stoma closure or peristomal hernia repair", page: 1138 },
  { name: "Operations for rectal prolapse", page: 1147 },
  { name: "Rectal surgery", page: 1150 },
  { name: "Anorectal surgery", page: 1155 },
  { name: "Surgery for anal fistulas", page: 1156 },
  { name: "Hemorrhoidectomy/stapled hemorrhoidopexy", page: 1159 },
  { name: "Operations for fecal incontinence", page: 1162 },
  // 7.5 Hepatic Surgery
  { name: "Hepatic resection", page: 1170 },
  { name: "Hepatorrhaphy", page: 1176 },
  // 7.6 Biliary Tract Surgery
  { name: "Open cholecystectomy and common bile duct exploration", page: 1184 },
  { name: "Biliary drainage procedures", page: 1188 },
  { name: "Excision of bile duct tumor", page: 1193 },
  { name: "Choledochal cyst excision or anastomosis", page: 1196 },
  { name: "Anesthetic considerations for biliary tract surgery", page: 1198 },
  // 7.7 Laparoscopic General Surgery
  { name: "Laparoscopic repair of perforated peptic ulcer", page: 1204 },
  { name: "Laparoscopic esophageal fundoplication", page: 1206 },
  { name: "Laparoscopic Heller myotomy ± antireflux procedure", page: 1211 },
  { name: "Laparoscopic cholecystectomy, ± common duct exploration", page: 1214 },
  { name: "Laparoscopic splenectomy", page: 1224 },
  { name: "Laparoscopic adrenalectomy", page: 1232 },
  { name: "Laparoscopic bowel resection", page: 1238 },
  { name: "Laparoscopic appendectomy", page: 1245 },
  { name: "Laparoscopic inguinal hernia repair", page: 1250 },
  { name: "Laparoscopic bariatric surgery", page: 1256 },
  { name: "Anesthesia for laparoscopy in pregnancy", page: 1274 },
  // 7.8 Pancreatic Surgery
  { name: "Operative drainage for pancreatitis", page: 1282 },
  { name: "Drainage of pancreatic pseudocyst", page: 1285 },
  // 7.11 Endocrine Surgery
  { name: "Excision of thyroglossal duct cyst", page: 1368 },
  { name: "Thyroidectomy", page: 1372 },
  { name: "Parathyroidectomy", page: 1385 },
  { name: "Adrenalectomy", page: 1395 },
  { name: "Pheochromocytoma resection (anesthetic considerations)", page: 1408 },
  // 8.1 Gynecologic Oncology
  { name: "Staging laparotomy for ovarian/fallopian tube/peritoneal cancer", page: 1544 },
  { name: "Cytoreductive/second look laparotomy", page: 1554 },
  { name: "Radical vulvectomy", page: 1562 },
  { name: "Conization of the cervix", page: 1573 },
  { name: "Laser therapy to vulva/vagina/cervix", page: 1579 },
  { name: "Suction curettage for gestational trophoblastic disease", page: 1582 },
  { name: "Pelvic exenteration", page: 1590 },
  { name: "Exploratory laparotomy/hysterectomy/BSO for uterine cancer", page: 1602 },
  { name: "Radical hysterectomy", page: 1609 },
  { name: "Robotic-assisted laparoscopy in gynecologic oncology", page: 1617 },
  { name: "Interstitial perineal implants", page: 1620 },
  // 8.2 Gynecology/Infertility Surgery
  { name: "D&C (dilation and curettage)", page: 1628 },
  { name: "D&E (dilation and evacuation)", page: 1631 },
  { name: "Hysteroscopy", page: 1638 },
  { name: "Pelvic laparotomy (gynecologic)", page: 1645 },
  { name: "TVOR (transvaginal oocyte retrieval)", page: 1649 },
  { name: "Infertility/assisted reproductive technologies", page: 1653 },
  { name: "Hysterectomy (vaginal/abdominal/laparoscopic/robotic)", page: 1663 },
  { name: "Operations for pelvic organ prolapse", page: 1673 },
  { name: "Operations for stress urinary incontinence", page: 1680 },
  // 8.3 Obstetric Surgery
  { name: "Cesarean section", page: 1689 },
  { name: "Management of postpartum hemorrhage", page: 1707 },
  { name: "Repair of uterine rupture", page: 1711 },
  { name: "Postpartum tubal ligation", page: 1714 },
  { name: "Repair of vaginal/cervical lacerations", page: 1720 },
  { name: "Cervical cerclage", page: 1726 },
  { name: "Removal of retained placenta", page: 1732 },
  { name: "Management of uterine inversion", page: 1739 },
  // 8.4 Laparoscopic Gynecologic Procedures
  { name: "Laparoscopic surgery for endometriosis", page: 1746 },
  { name: "Laparoscopic surgery for ectopic pregnancy or adnexal mass", page: 1755 },
  { name: "Laparoscopic myomectomy", page: 1759 },
  { name: "Laparoscopic hysterectomy", page: 1763 },
  { name: "Laparoscopic surgery for vaginal vault suspension", page: 1768 },
  // 9.0 Urology
  { name: "Diagnostic transurethral (endoscopic) procedures", page: 1777 },
  { name: "Therapeutic transurethral procedures (except TURP)", page: 1779 },
  { name: "Transurethral resection of the prostate (TURP)", page: 1786 },
  { name: "Transurethral resection (non-prostate)", page: 1779 },
  { name: "Open prostate operations", page: 1796 },
  { name: "Operations on the renal pelvis and upper ureter", page: 1814 },
  { name: "Nephrectomy", page: 1807 },
  { name: "Cystectomy", page: 1821 },
  { name: "Open bladder operations (urology)", page: 1831 },
  { name: "Inguinal operations (urology)", page: 1836 },
  { name: "Penile operations (adult)", page: 1843 },
  { name: "Scrotal operations", page: 1848 },
  { name: "Perineal operations (urology)", page: 1854 },
  { name: "Vaginal operations (urology)", page: 1859 },
  { name: "Special considerations for robotic-assisted laparoscopic procedures (urology)", page: 1864 },
  // 10.1 Hand Surgery
  { name: "Darrach procedure", page: 1869 },
  { name: "Dorsal stabilization and extensor synovectomy of the rheumatoid wrist", page: 1872 },
  { name: "Metacarpophalangeal and interphalangeal joint arthroplasty and arthrodesis", page: 1875 },
  { name: "Arthrodesis of the wrist", page: 1877 },
  { name: "Total wrist replacement", page: 1880 },
  { name: "Thumb carpometacarpal joint fusion/arthroplasty/stabilization", page: 1882 },
  { name: "Excision of ganglion of the wrist", page: 1889 },
  { name: "Palmar and digital fasciectomy", page: 1891 },
  { name: "Repair of lacerated tendons/nerves (hand)", page: 1893 },
  { name: "Wrist arthroscopy/repair of triangular fibrocartilage complex tear", page: 1901 },
  { name: "Carpal tunnel release", page: 1903 },
  { name: "Fixation of fractures and dislocations of the wrist and hand", page: 1909 },
  { name: "Digit and hand replantation", page: 1915 },
  // 10.2 Shoulder/Arm Surgery
  { name: "Arthroscopic shoulder surgery", page: 1923 },
  { name: "Surgery for acromial impingement, rotator cuff tears, and acromioclavicular joint arthritis", page: 1927 },
  { name: "Surgery for shoulder instability", page: 1934 },
  { name: "Glenohumeral shoulder arthroplasty", page: 1945 },
  { name: "Shoulder girdle procedures", page: 1954 },
  { name: "Brachial plexus surgery", page: 1957 },
  { name: "Arm surgery (upper extremity)", page: 1965 },
  // 10.3 Spine Surgery—Minimally Invasive
  { name: "Minimally invasive posterior lumbar discectomy (microdiscectomy)", page: 1971 },
  { name: "Minimally invasive anterior lumbar interbody fusion through a transpsoas approach", page: 1974 },
  { name: "Spinal reconstruction and fusion—thoracic and thoracolumbar spine", page: 1981 },
  { name: "Spinal reconstruction and fusion—lumbosacral spine", page: 1987 },
  { name: "Spinal reconstruction and fusion—cervical spine", page: 1994 },
  // 10.4 Hip, Pelvis, Upper Leg Surgery
  { name: "ORIF of pelvis or acetabulum", page: 2008 },
  { name: "Closed reduction and external fixation of the pelvis", page: 2013 },
  { name: "ORIF of acetabulum fractures", page: 2015 },
  { name: "Osteotomy and bone graft augmentation of the pelvis", page: 2021 },
  { name: "Arthrodesis of the sacroiliac joint", page: 2024 },
  { name: "Amputations about the hip and pelvis: disarticulation of the hip and hindquarter amputation", page: 2026 },
  { name: "Arthroplasty of the hip", page: 2036 },
  { name: "Arthrodesis of the hip", page: 2041 },
  { name: "Synovectomy of the hip", page: 2044 },
  { name: "ORIF of proximal femoral fractures (femoral neck, intertrochanteric, subtrochanteric fractures)", page: 2053 },
  { name: "ORIF of distal femur fractures", page: 2059 },
  { name: "ORIF of the femoral shaft with plate", page: 2061 },
  { name: "Intramedullary nailing of femoral shaft", page: 2063 },
  { name: "Repair of nonunion/malunion of proximal third of femur, proximal femoral osteotomy for osteoarthritis", page: 2067 },
  { name: "Closed reduction and external fixation of femur", page: 2069 },
  // 10.5 Knee Surgery
  { name: "Arthroplasty of the knee", page: 2072 },
  { name: "Arthrodesis of the knee", page: 2076 },
  { name: "ORIF of patellar fractures", page: 2079 },
  { name: "Repair or reconstruction of knee ligaments", page: 2081 },
  { name: "Patellar realignment (adult)", page: 2084 },
  { name: "Arthroscopy of the knee", page: 2087 },
  { name: "Knee arthrotomy", page: 2090 },
  { name: "Repair of tendons—knee and leg", page: 2091 },
  // 10.6 Lower Leg, Ankle, Foot, and Other Lower-Extremity Procedures
  { name: "ORIF of the tibial plateau fracture", page: 2103 },
  { name: "Intramedullary nailing, tibia", page: 2106 },
  { name: "External fixation, tibia", page: 2107 },
  { name: "ORIF of distal tibia, ankle, and foot fractures", page: 2109 },
  { name: "Repair nonunion/malunion, tibia", page: 2111 },
  { name: "Arthroscopy of the ankle", page: 2114 },
  { name: "Ankle arthrotomy", page: 2116 },
  { name: "Ankle arthrodesis", page: 2117 },
  { name: "Repair/reconstruction of ankle ligaments", page: 2122 },
  { name: "Amputation through ankle (Syme)", page: 2123 },
  { name: "Amputation, transmetatarsal", page: 2127 },
  { name: "Lengthening or transfer of tendons, ankle, and foot", page: 2128 },
  { name: "Amputation above the knee", page: 2130 },
  { name: "Amputation below the knee", page: 2133 },
  { name: "Fasciotomy of the thigh", page: 2140 },
  { name: "Fasciotomy of the leg", page: 2143 },
  { name: "Biopsy or drainage of abscess/excision of tumor (lower extremity)", page: 2151 },
  // 11.1 Facial Cosmetic Surgery
  { name: "Introduction to cosmetic facial surgery", page: 2161 },
  { name: "Facelift and necklift", page: 2162 },
  { name: "Browlift and blepharoplasty", page: 2173 },
  { name: "Rhinoplasty", page: 2185 },
  { name: "Facial laser resurfacing", page: 2192 },
  // 11.2 Nonfacial Aesthetic Surgery
  { name: "Augmentation mammoplasty", page: 2195 },
  { name: "Reduction mammoplasty", page: 2198 },
  { name: "Mastopexy/breast lift", page: 2202 },
  { name: "Brachioplasty", page: 2207 },
  { name: "Abdominoplasty", page: 2210 },
  { name: "Body lifts", page: 2219 },
  { name: "Liposuction", page: 2221 },
  // 11.3 Craniofacial Surgery
  { name: "Repair of facial fractures", page: 2230 },
  { name: "LeFort osteotomies", page: 2248 },
  { name: "Mandibular osteotomies/genioplasty", page: 2253 },
  // 11.4 Functional Restoration (Microsurgery and Reconstruction)
  { name: "Microsurgery-free-flap reconstruction", page: 2264 },
  { name: "Microsurgery-replantation", page: 2273 },
  { name: "Breast surgery—introduction", page: 2280 },
  { name: "Breast reconstruction", page: 2281 },
  { name: "Chest wall reconstruction", page: 2291 },
  { name: "Pressure sore reconstruction", page: 2297 },
  // 11.5 Burn Surgery
  { name: "Free skin graft for burn wound (with tangential excision, excision to fascia, or debridement)", page: 2306 },
  // 12.1 Pediatric Neurosurgery
  { name: "Craniofacial surgery (pediatric)", page: 2321 },
  { name: "Closure of myelomeningocele", page: 2331 },
  { name: "Surgical correction of occult spinal dysraphism", page: 2338 },
  { name: "Craniotomy for vein of Galen malformation", page: 2361 },
  { name: "Ventriculoscopy and third ventriculostomy", page: 2344 },
  { name: "Pediatric brain arteriovenous malformations (AVM)", page: 2350 },
  // 12.2 Pediatric Ophthalmic Surgery
  { name: "Strabismus surgery", page: 2367 },
  { name: "Pediatric vitreoretinal surgery", page: 2376 },
  // 12.3 Pediatric Otolaryngology
  { name: "Myringotomy and tympanostomy tube placement", page: 2390 },
  { name: "Tonsillectomy and adenoidectomy (pediatric)", page: 2396 },
  { name: "Bronchoscopy/esophagoscopy (pediatric)", page: 2405 },
  { name: "Laryngoscopy, supraglottoplasty, excision of laryngeal lesions (pediatric)", page: 2407 },
  { name: "Removal of branchial cleft cyst or thyroglossal duct cyst (pediatric)", page: 2416 },
  { name: "Incision/drainage of deep neck abscess (pediatric)", page: 2418 },
  { name: "Laryngotracheal reconstruction, cricotracheal resection, laryngotracheoplasty", page: 2423 },
  { name: "Choanal atresia repair", page: 2428 },
  { name: "Pediatric tracheostomy", page: 2432 },
  // 12.4 Pediatric Cardiovascular Surgery
  { name: "Surgery for atrial septal defect (ostium secundum)", page: 2435 },
  { name: "Surgery for atrioventricular canal defect", page: 2446 },
  { name: "Surgery for ventricular septal defect", page: 2456 },
  { name: "Surgery for patent ductus arteriosus", page: 2463 },
  { name: "Surgery for coarctation of the aorta", page: 2470 },
  { name: "Surgery for tetralogy of Fallot", page: 2479 },
  { name: "Surgery for total anomalous pulmonary venous connection", page: 2492 },
  { name: "Surgery for complete transposition of the great arteries", page: 2501 },
  { name: "Surgery for truncus arteriosus", page: 2510 },
  { name: "Surgery for tricuspid atresia", page: 2516 },
  { name: "Surgery for double-outlet right ventricle", page: 2523 },
  { name: "Surgery for hypoplastic left heart syndrome", page: 2527 },
  // 12.5 Pediatric General Surgery
  { name: "Cystic hygroma, branchial cleft cyst, thyroglossal duct cyst", page: 2537 },
  { name: "Foreign body removal and dilation (esophageal)", page: 2543 },
  { name: "Repair of tracheoesophageal fistula and esophageal atresia", page: 2554 },
  { name: "Mediastinal mass—biopsy or resection (pediatric)", page: 2564 },
  { name: "Neonatal lung resection", page: 2572 },
  { name: "Drainage of empyema (pediatric)", page: 2580 },
  { name: "Repair of pectus excavatum/carinatum", page: 2583 },
  { name: "Esophageal replacement, colon interposition (pediatric)", page: 2590 },
  { name: "Repair of congenital diaphragmatic hernia", page: 2595 },
  { name: "Pyloromyotomy for pyloric stenosis", page: 2604 },
  { name: "Resection of neuroblastoma, Wilms' tumor, hepatic tumors (pediatric)", page: 2611 },
  { name: "Laparotomy for intestinal perforation, necrotizing enterocolitis", page: 2618 },
  { name: "Repair of biliary atresia and choledochal cysts", page: 2626 },
  { name: "Repair of omphalocele/gastroschisis", page: 2633 },
  { name: "Pull-through for Hirschsprung's disease", page: 2641 },
  { name: "Pull-through for imperforate anus, cloaca", page: 2647 },
  { name: "Repair of inguinal & umbilical hernias, hydrocele (pediatric)", page: 2653 },
  { name: "Surgery for undescended testicle (orchiopexy)", page: 2659 },
  { name: "Resection of sacrococcygeal teratoma", page: 2662 },
  { name: "Minimally invasive surgery in pediatric patients", page: 2667 },
  { name: "Ex utero intrapartum treatment (EXIT) procedure", page: 2671 },
  { name: "Pediatric bariatric surgery", page: 2679 },
  // 12.6 Pediatric Urology
  { name: "Kidney and upper urinary tract operations (pediatric)", page: 2689 },
  { name: "Transurethral procedures (pediatric)", page: 2702 },
  { name: "Open bladder operations (pediatric)", page: 2707 },
  { name: "Bladder augmentation (pediatric)", page: 2711 },
  { name: "Penile surgery (pediatric)", page: 2715 },
  { name: "Genital procedures: clitoroplasty, vaginoplasty, urethroplasty (pediatric)", page: 2719 },
  { name: "Inguinoscrotal procedures (pediatric)", page: 2725 },
  { name: "Laparoscopic urologic procedures (pediatric)", page: 2732 },
  { name: "Robotic-assisted urologic procedures (pediatric)", page: 2732 },
  { name: "Stone procedures (pediatric)", page: 2700 },
  // 12.7 Pediatric Orthopedic Surgery
  { name: "Percutaneous pinning of displaced supracondylar humerus fracture", page: 2739 },
  { name: "Closed or open reduction of displaced lateral condyle humerus fracture", page: 2743 },
  { name: "Aspiration and injection of unicameral bone cyst", page: 2746 },
  { name: "Release for torticollis", page: 2749 },
  { name: "Pollicization of a finger", page: 2751 },
  { name: "Syndactyly repair", page: 2754 },
  { name: "Posterior spinal instrumentation and fusion (pediatric)", page: 2761 },
  { name: "Anterior spinal fusion for scoliosis (pediatric)", page: 2768 },
  { name: "Pelvic osteotomy (pediatric)", page: 2772 },
  { name: "Acetabular augmentation (shelf) and Chiari osteotomy", page: 2776 },
  { name: "Ober fasciotomy, Yount-Ober release", page: 2779 },
  { name: "Hip open reduction and femoral shortening (pediatric)", page: 2781 },
  { name: "Adductor release or transfer, psoas release (pediatric)", page: 2785 },
  { name: "Pinning of slipped capital femoral epiphysis (SCFE)", page: 2788 },
  { name: "Flexible intramedullary nailing of long-bone fractures (pediatric)", page: 2790 },
  { name: "Proximal femoral osteotomy (pediatric)", page: 2793 },
  { name: "Epiphysiodesis", page: 2796 },
  { name: "Sofield procedure", page: 2800 },
  { name: "Limb lengthening", page: 2802 },
  { name: "Patellar realignment (pediatric)", page: 2807 },
  { name: "Tendon transfer, lengthening—posterior tibial (pediatric)", page: 2810 },
  { name: "Triple arthrodesis and Grice procedure (extra-articular subtalar arthrodesis)", page: 2813 },
  { name: "Surgical correction of clubfoot", page: 2816 },
  { name: "Surgery for epidermolysis bullosa", page: 2830 },
  // 12.8 Surgery for Craniofacial Malformations
  { name: "Surgical correction of craniosynostosis", page: 2836 },
  { name: "Major secondary craniofacial surgical procedures", page: 2849 },
  { name: "Cleft lip repair—unilateral/bilateral", page: 2857 },
  { name: "Palatoplasty", page: 2863 },
  { name: "Pharyngoplasty", page: 2868 },
  { name: "Alveolar cleft repair with bone graft", page: 2873 },
  { name: "Secondary cleft lip/nasal surgery", page: 2876 },
  { name: "Otoplasty", page: 2885 },
  // 12.9 Pediatric Transplantation
  { name: "Pediatric renal transplantation", page: 2891 },
  { name: "Pediatric liver transplantation", page: 2900 },
  // 13.1 Out-of-Operating Room Procedures—Adult
  { name: "Anesthesia for out-of-operating room procedures", page: 2920 },
  { name: "Electroconvulsive therapy (ECT)", page: 2922 },
  { name: "Interventional neuroradiology", page: 2933 },
  { name: "Direct current (DC) cardioversion", page: 2946 },
  { name: "Implantation of ICD or CRT-D (cardioverter-defibrillator)", page: 2952 },
  { name: "Extraction of pacemaker and ICD leads", page: 2956 },
  { name: "Catheter ablation of atrial fibrillation", page: 2959 },
  { name: "Transjugular intrahepatic portosystemic shunt (TIPS)", page: 2975 },
  { name: "Endoscopic retrograde cholangiopancreatography (ERCP)", page: 2984 },
  { name: "Imaging and image-guided procedures", page: 2989 },
  { name: "Tracheobronchial stenting", page: 3001 },
  { name: "Radiofrequency ablation of tumors", page: 3010 },
  { name: "Irreversible electroporation (IRE ablation)", page: 3019 },
  // 13.2 Out-of-Operating Room Procedures—Pediatric
  { name: "Pediatric radiation therapy", page: 3028 },
  { name: "Cardiac catheterization and electrophysiology (pediatric)", page: 3037 },
  { name: "Pediatric oncologic procedures", page: 3059 },
  { name: "Upper/lower GI endoscopy (pediatric)", page: 3069 },
  { name: "Cross-sectional imaging CT/MRI (pediatric)", page: 3082 },
  { name: "Surgical considerations for ECMO", page: 3085 },
  { name: "Anesthetic management for surgical procedures under ECMO", page: 3088 },
  // 14.0 Office-Based Anesthesia
  { name: "Introduction—anesthesiologist's perspective (office-based)", page: 3091 },
  { name: "Facial rejuvenation: lasers and RF tissue tightening", page: 3094 },
  { name: "Office dental rehabilitation under deep IV sedation", page: 3098 },
  { name: "Dental implants and bone grafting", page: 3104 },
  // 15.0 Emergency Procedures for the Anesthesiologist
  { name: "Emergency cricothyrotomy", page: 3109 },
  { name: "Emergency pericardiocentesis", page: 3114 },
  { name: "Emergency ultrasound-guided pericardiocentesis", page: 3115 },
  { name: "Emergent needle/catheter thoracostomy", page: 3120 },
  { name: "Emergent ultrasound-guided needle/catheter thoracostomy", page: 3122 },
  { name: "Emergency intraosseous access", page: 3126 }
];

// Abbreviation expansions for broader search
const ABBREVIATIONS = {
  'lap': 'laparoscopic',
  'orif': 'open reduction',
  'cea': 'carotid endarterectomy',
  'cabg': 'coronary artery bypass',
  'cea': 'carotid endarterectomy',
  'roa': 'approach',
  'graft': 'bypass',
  'nailing': 'intramedullary',
  'arthroplasty': 'replacement',
  'arthrodesis': 'fusion',
  'dbs': 'deep brain stimulation',
  'scfe': 'slipped capital femoral',
  'vsd': 'ventricular septal',
  'asd': 'atrial septal',
  'pda': 'patent ductus',
  'tof': 'tetralogy of fallot',
  'echmo': 'ecmo'
};

let currentMatchedSurgery = null;
let highlightedIndex = -1;
let currentMatches = [];

function expandQuery(query) {
  let expanded = query.toLowerCase();
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    if (expanded.includes(abbr)) {
      expanded += ' ' + full;
    }
  }
  return expanded;
}

function normalizeToken(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function damerauLevenshtein(a, b, maxDistance) {
  const s = normalizeToken(a);
  const t = normalizeToken(b);
  const m = s.length;
  const n = t.length;

  if (!m) return n;
  if (!n) return m;
  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    let rowBest = maxDistance + 1;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );

      if (
        i > 1 &&
        j > 1 &&
        s[i - 1] === t[j - 2] &&
        s[i - 2] === t[j - 1]
      ) {
        best = Math.min(best, dp[i - 2][j - 2] + 1);
      }

      dp[i][j] = best;
      rowBest = Math.min(rowBest, best);
    }
    if (rowBest > maxDistance) return maxDistance + 1;
  }

  return dp[m][n];
}

function fuzzyTokenScore(term, token) {
  const q = normalizeToken(term);
  const w = normalizeToken(token);
  if (!q || !w) return 0;
  if (w.includes(q)) return 85;

  const maxDistance = q.length <= 4 ? 1 : (q.length <= 8 ? 2 : 3);
  const dist = damerauLevenshtein(q, w, maxDistance);
  if (dist > maxDistance) return 0;

  if (dist === 0) return 90;
  if (dist === 1) return 70;
  if (dist === 2) return 55;
  return 45;
}

function scoreSurgeryForTerms(surgeryName, terms) {
  const surgeryLower = surgeryName.toLowerCase();
  const tokens = surgeryLower.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;

  for (const term of terms) {
    if (surgeryLower.includes(term)) {
      score += 100;
      continue;
    }

    let bestTokenScore = 0;
    for (const token of tokens) {
      const tokenScore = fuzzyTokenScore(term, token);
      if (tokenScore > bestTokenScore) bestTokenScore = tokenScore;
    }
    score += bestTokenScore;
  }

  return score;
}

function searchJaffeSurgeries(query) {
  if (!query || query.trim().length < 2) return [];
  const expanded = expandQuery(query);
  const terms = expanded
    .toLowerCase()
    .split(/\s+/)
    .map(t => normalizeToken(t))
    .filter(t => t.length > 1);

  if (!terms.length) return [];

  return JAFFE_SURGERIES
    .map(s => ({ surgery: s, score: scoreSurgeryForTerms(s.name, terms) }))
    .filter(item => item.score >= 70)
    .sort((a, b) => b.score - a.score || a.surgery.name.localeCompare(b.surgery.name))
    .slice(0, 15)
    .map(item => item.surgery);
}

function renderSurgeryDropdown(matches) {
  const dropdown = document.getElementById('surgery-suggestions');
  currentMatches = matches;
  highlightedIndex = -1;
  
  if (!matches || matches.length === 0) {
    dropdown.classList.remove('show');
    return;
  }
  dropdown.innerHTML = matches.map((s, idx) => {
    const safeName = s.name.replace(/'/g, "\\'");
    return `<div class="surgery-suggestion-item" data-index="${idx}" data-page="${s.page}" data-name="${s.name}">
      <span class="ssi-name" onclick="selectSurgery('${safeName}', ${s.page})">${s.name}<span class="surgery-suggestion-page">p. ${s.page}</span></span>
      <button type="button" class="ssi-jaffe-btn" onmousedown="linkJaffeOnly(${s.page}); return false;" title="Link Jaffe page only (keeps your typed text)">📖 Jaffe</button>
    </div>`;
  }).join('');
  dropdown.classList.add('show');
}

function highlightItem(index) {
  const items = document.querySelectorAll('.surgery-suggestion-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

function selectSurgery(name, page) {
  document.getElementById('pat-surgery').value = name;
  currentMatchedSurgery = { name, page };
  // Clear dismissed state since user picked a surgery
  var ov = document.getElementById('pat-jaffe-page-override');
  if (ov) { ov.value = ''; saveState(); }
  updateJaffeBadge(page);
  document.getElementById('surgery-suggestions').classList.remove('show');
  highlightedIndex = -1;
}

function linkJaffeOnly(page) {
  // Appends Jaffe chapter without changing the typed surgery text
  addJaffePage(page);
  document.getElementById('surgery-suggestions').classList.remove('show');
  highlightedIndex = -1;
}

var _jaffePdfUrl = null;

// Chapter map: each entry covers [startPage, endPage] (1-based, inclusive)
// matching the split files uploaded to Firebase Storage under chapters/
var JAFFE_CHAPTERS = [
  { file: 'chapters/jaffe-neurosurgery.pdf',    start: 1,    end: 342  },
  { file: 'chapters/jaffe-ophthalmic.pdf',      start: 343,  end: 405  },
  { file: 'chapters/jaffe-ent.pdf',             start: 406,  end: 605  },
  { file: 'chapters/jaffe-thoracic.pdf',        start: 606,  end: 746  },
  { file: 'chapters/jaffe-cardiovascular.pdf',  start: 747,  end: 1029 },
  { file: 'chapters/jaffe-general-surgery.pdf', start: 1030, end: 1542 },
  { file: 'chapters/jaffe-obgyn.pdf',           start: 1543, end: 1775 },
  { file: 'chapters/jaffe-urology.pdf',         start: 1776, end: 1867 },
  { file: 'chapters/jaffe-orthopedic.pdf',      start: 1868, end: 2159 },
  { file: 'chapters/jaffe-plastic.pdf',         start: 2160, end: 2319 },
  { file: 'chapters/jaffe-pediatric.pdf',       start: 2320, end: 2918 },
  { file: 'chapters/jaffe-non-or.pdf',          start: 2919, end: 3089 },
  { file: 'chapters/jaffe-office-based.pdf',    start: 3090, end: 3108 },
  { file: 'chapters/jaffe-emergency.pdf',       start: 3109, end: 3469 },
];

// URL cache keyed by storage path, populated on auth
var _jaffePdfUrls = {};

function getChapterForPage(page) {
  for (var i = 0; i < JAFFE_CHAPTERS.length; i++) {
    var ch = JAFFE_CHAPTERS[i];
    if (page >= ch.start && page <= ch.end) {
      return { file: ch.file, offsetPage: page - ch.start + 1 };
    }
  }
  // fallback — shouldn't happen
  return { file: JAFFE_CHAPTERS[0].file, offsetPage: page };
}

// Pre-fetch URLs for all chapters once auth is ready
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    JAFFE_CHAPTERS.forEach(function(ch) {
      if (!_jaffePdfUrls[ch.file]) {
        firebase.storage().ref(ch.file).getDownloadURL()
          .then(function(url) { _jaffePdfUrls[ch.file] = url; })
          .catch(function() {});
      }
    });
  }
});

function openJaffePage(page) {
  var ch = getChapterForPage(page);
  var cachedUrl = _jaffePdfUrls[ch.file];
  if (cachedUrl) {
    window.open(cachedUrl + '#page=' + ch.offsetPage, '_blank');
    return;
  }
  // Not yet cached — open blank tab and fetch URL
  var win = window.open('', '_blank');
  try {
    var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
      unsubscribe();
      if (user) {
        firebase.storage().ref(ch.file).getDownloadURL()
          .then(function(url) {
            _jaffePdfUrls[ch.file] = url;
            win.location.href = url + '#page=' + ch.offsetPage;
          })
          .catch(function(err) { win.close(); alert('Could not open Jaffe PDF: ' + err.message); });
      } else {
        win.close();
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
          .then(function() { return firebase.storage().ref(ch.file).getDownloadURL(); })
          .then(function(url) { _jaffePdfUrls[ch.file] = url; window.open(url + '#page=' + ch.offsetPage, '_blank'); })
          .catch(function() { alert('Sign in required to open the Jaffe PDF.'); });
      }
    });
  } catch(e) {
    win.close();
    alert('Firebase not available.');
  }
}

// --- Jaffe multi-chapter helpers ---
function getJaffePages() {
  var ov = document.getElementById('pat-jaffe-page-override');
  var val = ov ? ov.value.trim() : '';
  if (!val || val === 'dismissed') return [];
  return val.split(',').map(Number).filter(Boolean);
}
function setJaffePages(pages) {
  var ov = document.getElementById('pat-jaffe-page-override');
  if (ov) { ov.value = pages.length ? pages.join(',') : 'dismissed'; saveState(); }
}
function addJaffePage(page) {
  var pages = getJaffePages();
  if (!pages.includes(page)) pages.push(page);
  setJaffePages(pages);
  updateJaffeBadge(null);
}
function removeJaffePage(page) {
  var ov = document.getElementById('pat-jaffe-page-override');
  var pages = getJaffePages();
  if (!pages.length) {
    // Was auto-detected, just dismiss
    if (ov) { ov.value = 'dismissed'; saveState(); }
    updateJaffeBadge(null);
    setTimeout(function() { var inp = document.getElementById('jaffe-search-input'); if (inp) inp.focus(); }, 50);
    return;
  }
  pages = pages.filter(function(p) { return p !== page; });
  setJaffePages(pages);
  updateJaffeBadge(null);
  if (!pages.length) setTimeout(function() { var inp = document.getElementById('jaffe-search-input'); if (inp) inp.focus(); }, 50);
}
function addJaffeChapter() {
  // Pin any auto-detected page into override so it isn't lost when we add a second
  var ov = document.getElementById('pat-jaffe-page-override');
  if (ov && (!ov.value || ov.value === 'dismissed')) {
    var badge = document.getElementById('jaffe-badge');
    var pinPages = [];
    if (badge) badge.querySelectorAll('button').forEach(function(b) {
      var m = (b.getAttribute('onclick') || '').match(/openJaffePage\((\d+)\)/);
      if (m) pinPages.push(parseInt(m[1]));
    });
    if (pinPages.length) { ov.value = pinPages.join(','); saveState(); }
  }
  var searchWrap = document.getElementById('jaffe-search-wrap');
  if (searchWrap) {
    searchWrap.style.display = 'inline-block';
    setTimeout(function() { var inp = document.getElementById('jaffe-search-input'); if (inp) { inp.value = ''; inp.focus(); } }, 50);
  }
}

function updateJaffeBadge(page) {
  const badge = document.getElementById('jaffe-badge');
  const searchWrap = document.getElementById('jaffe-search-wrap');
  const override = document.getElementById('pat-jaffe-page-override');
  const overrideVal = override ? override.value : '';

  var pages;
  if (overrideVal && overrideVal !== 'dismissed') {
    pages = overrideVal.split(',').map(Number).filter(Boolean);
  } else if (overrideVal === 'dismissed') {
    pages = [];
  } else if (page) {
    pages = [page];
  } else {
    pages = [];
  }

  if (pages.length) {
    badge.innerHTML =
      pages.map(function(p) {
        return `<span style="display:inline-flex;align-items:center;gap:0;margin-right:16px;padding-right:16px;border-right:1px solid #d4a574;">` +
          `<button type="button" onclick="removeJaffePage(${p})" title="Remove" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#b08060;color:white;border:none;cursor:pointer;font-size:14px;font-weight:900;line-height:1;margin-right:5px;padding:0;">&times;</button>` +
          `<button type="button" onclick="openJaffePage(${p})" style="background:none;border:none;padding:0;font:inherit;color:inherit;cursor:pointer;">📖 Jaffe 6th Ed p.${p}</button>` +
          `</span>`;
      }).join('') +
      `<button type="button" onclick="addJaffeChapter()" title="Add another chapter" style="background:none;border:none;padding:0;color:#5a7ea0;cursor:pointer;font-size:11px;font-weight:600;line-height:1;margin-left:8px;">+ Add</button>`;
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.flexWrap = 'wrap';
    badge.onclick = null;
    if (searchWrap) searchWrap.style.display = 'none';
  } else {
    badge.innerHTML = '';
    badge.style.display = 'none';
    badge.onclick = null;
    if (searchWrap) { searchWrap.style.display = 'inline-block'; }
  }
}

var _jaffeSearchHighlight = -1;
var _jaffeSearchMatches = [];

function onJaffeSearchInput(val) {
  var resultsEl = document.getElementById('jaffe-search-results');
  _jaffeSearchMatches = searchJaffeSurgeries(val);
  _jaffeSearchHighlight = -1;
  if (!_jaffeSearchMatches.length) { resultsEl.style.display = 'none'; return; }
  resultsEl.innerHTML = _jaffeSearchMatches.map(function(s, i) {
    return `<div class="jaffe-search-item" data-idx="${i}" onmousedown="pickJaffeResult(${i})">${s.name}<span class="jspage">p.${s.page}</span></div>`;
  }).join('');
  resultsEl.style.display = 'block';
}

function onJaffeSearchKey(e) {
  var resultsEl = document.getElementById('jaffe-search-results');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _jaffeSearchHighlight = Math.min(_jaffeSearchHighlight + 1, _jaffeSearchMatches.length - 1);
    highlightJaffeItem();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _jaffeSearchHighlight = Math.max(_jaffeSearchHighlight - 1, 0);
    highlightJaffeItem();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_jaffeSearchHighlight >= 0) pickJaffeResult(_jaffeSearchHighlight);
    else if (_jaffeSearchMatches.length === 1) pickJaffeResult(0);
  } else if (e.key === 'Escape') {
    closeJaffeSearch();
  }
}

function highlightJaffeItem() {
  document.querySelectorAll('.jaffe-search-item').forEach(function(el, i) {
    el.classList.toggle('highlighted', i === _jaffeSearchHighlight);
  });
}

function pickJaffeResult(idx) {
  var s = _jaffeSearchMatches[idx];
  if (!s) return;
  addJaffePage(s.page); // appends to existing chapters
  var inp = document.getElementById('jaffe-search-input');
  if (inp) inp.value = '';
  closeJaffeSearch();
  var searchWrap = document.getElementById('jaffe-search-wrap');
  if (searchWrap) searchWrap.style.display = 'none';
}

function closeJaffeSearch() {
  var el = document.getElementById('jaffe-search-results');
  if (el) el.style.display = 'none';
  _jaffeSearchMatches = []; _jaffeSearchHighlight = -1;
}

const surgeryInput = document.getElementById('pat-surgery');
surgeryInput.addEventListener('input', (e) => {
  const value = e.target.value;
  const matches = searchJaffeSurgeries(value);
  renderSurgeryDropdown(matches);
  
  const exactMatch = JAFFE_SURGERIES.find(s => s.name.toLowerCase() === value.toLowerCase());
  if (exactMatch) {
    currentMatchedSurgery = exactMatch;
    // Reset dismissed state when user picks a new surgery
    var ov = document.getElementById('pat-jaffe-page-override');
    if (ov && ov.value === 'dismissed') { ov.value = ''; saveState(); }
    updateJaffeBadge(exactMatch.page);
  } else {
    currentMatchedSurgery = null;
    updateJaffeBadge(null);
  }
});

surgeryInput.addEventListener('keydown', (e) => {
  const dropdown = document.getElementById('surgery-suggestions');
  const isOpen = dropdown.classList.contains('show');
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen) return;
    highlightedIndex = Math.min(highlightedIndex + 1, currentMatches.length - 1);
    highlightItem(highlightedIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!isOpen) return;
    highlightedIndex = Math.max(highlightedIndex - 1, -1);
    if (highlightedIndex === -1) {
      document.querySelectorAll('.surgery-suggestion-item').forEach(item => item.classList.remove('highlighted'));
    } else {
      highlightItem(highlightedIndex);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedIndex >= 0 && highlightedIndex < currentMatches.length) {
      const match = currentMatches[highlightedIndex];
      selectSurgery(match.name, match.page);
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.remove('show');
    highlightedIndex = -1;
  }
});

surgeryInput.addEventListener('blur', () => {
  setTimeout(() => {
    document.getElementById('surgery-suggestions').classList.remove('show');
    highlightedIndex = -1;
  }, 150);
});
