const langMap = {
  en: {
    login: "Login",
    register: "Registration",
    registerBtn: "Sign Up",
    registerSubmit: "Submit",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    username: "Username",
    required: "This field is required",
    invalidEmail: "Invalid email format",
    invalidPassword: "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
    mismatch: "Passwords do not match",
    shortUsername: "Username must be at least 3 characters",

    //BackEnd Errors
    username_exists: "Username already exists",
    email_exists: "Email already exists",
    password_error: "Password Error",
    registration_failed: "Registration failed",
    registration_success: "Successfully Registered",
    something_went_wrong: "Something went wrong",
    invalid_email_or_password: "Email or Password is incorrect",
  },

  am: {
    login: "Մուտք",
    register: "Գրանցվել",
    registerBtn: "Գրանցվել",
    registerSubmit: "Հաստատել",
    email: "Էլ․ հասցե",
    password: "Գաղտնաբառ",
    confirmPassword: "Հաստատել գաղտնաբառը",
    username: "Օգտանուն",
    required: "Այս դաշտը պարտադիր է",
    invalidEmail: "Սխալ էլ․ հասցե",
    invalidPassword: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ, պարունակի մեծատառ, փոքրատառ, թիվ և հատուկ նիշ",
    mismatch: "Գաղտնաբառերը չեն համընկնում",
    shortUsername: "Օգտանունը պետք է պարունակի առնվազն 3 նիշ",

    //BackEnd Errors
    username_exists: "Գրանցման անունը արդեն գոյություն ունի",
    email_exists: "Էլ. հասցեն արդեն գոյություն ունի",
    password_error: "Գաղտնաբառի սխալ",
    registration_failed: "Գրանցումը ձախողվեց",
    registration_success: "Գրանցումը հաջողվեց",
    something_went_wrong: "Տեղի է ունեցել անսպասելի սխալ",
    invalid_email_or_password: "Մուտքի տվյալները սխալ են",
  },

  fr: {
    login: "Connexion",
    register: "Inscription",
    registerBtn: "S’inscrire",
    registerSubmit: "Envoyer",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    username: "Nom d'utilisateur",
    required: "Ce champ est requis",
    invalidEmail: "Format d'e-mail invalide",
    invalidPassword: "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial",
    mismatch: "Mots de passe non identiques",
    shortUsername: "Le nom d'utilisateur doit contenir au moins 3 caractères",

    //BackEnd Errors
    username_exists: "Le nom d'utilisateur existe déjà",
    email_exists: "L’adresse e-mail existe déjà",
    password_error: "Erreur de mot de passe",
    registration_failed: "Échec de l'inscription",
    registration_success: "Inscription réussie",
    something_went_wrong: "Une erreur s'est produite",
    invalid_email_or_password: "E-mail ou mot de passe incorrect",
  }
};

function getLangFromURL() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  return langMap[lang] ? lang : "en";
}

let currentLang = getLangFromURL();

function updateURLWithLang(lang) {
  const url = new URL(window.location);
  url.searchParams.set("lang", lang);
  window.history.replaceState(null, "", url);
}

function changeLang(lang) {
  currentLang = lang;
  updateURLWithLang(lang);

  const t = langMap[lang];

  document.getElementById("loginBtn").innerText = t.login;
  document.getElementById("registerBtn").innerText = t.registerBtn;
  document.getElementById("loginTitle").innerText = t.login;
  document.getElementById("registerTitle").innerText = t.register;
  document.getElementById("loginEmail").placeholder = t.email;
  document.getElementById("loginPassword").placeholder = t.password;
  document.getElementById("loginSubmit").innerText = t.login;
  document.getElementById("regUsername").placeholder = t.username;
  document.getElementById("regEmail").placeholder = t.email;
  document.getElementById("regPassword").placeholder = t.password;
  document.getElementById("regConfirmPassword").placeholder = t.confirmPassword;
  document.getElementById("registerSubmit").innerText = t.registerSubmit;

  const flag = document.getElementById("langTrigger");
  if (flag) flag.src = `assets/${lang}.svg`;
}

window.changeLang = changeLang;
window.langMap = langMap;
window.currentLang = currentLang;