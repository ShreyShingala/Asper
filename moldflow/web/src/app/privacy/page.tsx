"use client";
import { useState } from "react";
import { Card, LangToggle, Logo } from "@/components/ui";

const T = {
  en: {
    title: "Privacy at Mold Busters", intro: "What we keep about you, why, and how to change it.",
    sections: [
      ["Your customer profile", "To help us serve you, Mold Busters keeps notes from your calls, texts, emails and forms (including things you tell us about your home and household) in a customer profile created with automated tools. Staff check new notes before they are used. Health details are never used in marketing, and we never record children's names, ages or schools."],
      ["Calls with our AI assistant", "Calls with Bruce, our AI assistant, are recorded and transcribed so we can understand your concern. Bruce tells you this at the start of every call."],
      ["Messages", "We only send offers by text or email when you've agreed to it, or within the time Canada's anti-spam law allows after you've bought from or asked us something. Every message says who we are. Reply STOP to stop, or HUMAN to reach a person."],
      ["Weather check-ins", "If a rainfall or flood warning covers your area and you've asked for storm check-ins, we may send a short safety message. It only includes an offer if you've agreed to receive offers."],
      ["Where data goes", "Some services we use are outside Canada (AI processing, voice calls, text and email delivery). We only send them what they need for that task."],
      ["Your choices", "You can see, correct or delete what we keep, change how we contact you, or stop personalised reminders at any time: reply to any message or call 1-877-566-6653. Our privacy officer can be reached at the same number."],
    ],
  },
  fr: {
    title: "Confidentialité chez Mold Busters", intro: "Ce que nous conservons, pourquoi, et comment le modifier.",
    sections: [
      ["Votre profil client", "Pour mieux vous servir, Mold Busters conserve les notes de vos appels, textos, courriels et formulaires (y compris ce que vous nous dites au sujet de votre maison et de votre foyer) dans un profil client créé au moyen d'outils automatisés. Notre équipe vérifie les nouvelles notes avant leur utilisation. Les renseignements de santé ne servent jamais au marketing, et nous n'enregistrons jamais le nom, l'âge ou l'école des enfants."],
      ["Appels avec notre assistant IA", "Les appels avec Bruce, notre assistant IA, sont enregistrés et transcrits pour bien comprendre votre situation. Bruce vous en informe au début de chaque appel."],
      ["Messages", "Nous n'envoyons des offres par texto ou courriel qu'avec votre accord, ou pendant la période permise par la loi canadienne anti-pourriel après un achat ou une demande. Chaque message indique qui nous sommes. Répondez ARRÊT pour vous désabonner, ou HUMAIN pour parler à une personne."],
      ["Suivis météo", "Si un avertissement de pluie ou d'inondation touche votre secteur et que vous avez demandé des suivis, nous pouvons envoyer un court message de sécurité. Il ne contient une offre que si vous avez accepté d'en recevoir."],
      ["Où vont les données", "Certains services que nous utilisons sont à l'extérieur du Canada (traitement IA, appels vocaux, envoi de textos et de courriels). Nous ne leur transmettons que ce qui est nécessaire."],
      ["Vos choix", "Vous pouvez consulter, corriger ou supprimer vos renseignements, changer la façon dont nous vous joignons ou arrêter les rappels personnalisés en tout temps : répondez à un message ou appelez le 1-877-566-6653. Notre responsable de la protection des renseignements personnels est joignable au même numéro."],
    ],
  },
};

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "fr">("en");
  const t = T[lang];
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between"><Logo /><LangToggle lang={lang} onChange={setLang} /></div>
      <h1 className="mt-8 text-h5 font-semibold text-ink">{t.title}</h1>
      <p className="mt-2 text-body font-light text-ink-body">{t.intro}</p>
      <div className="mt-6 space-y-4">
        {t.sections.map(([h, b]) => (
          <Card key={h} className="p-5"><h2 className="text-subheading font-semibold text-ink">{h}</h2><p className="mt-1 text-subtitle text-ink-body">{b}</p></Card>
        ))}
      </div>
      <p className="mt-6 text-caption text-ink-muted">Prototype wording for review by Mold Busters&apos; privacy officer and counsel.</p>
    </main>
  );
}
