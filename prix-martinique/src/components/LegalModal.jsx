import React from 'react';
import { X, Mail } from 'lucide-react';
import { CONTACT_EMAIL } from '../constants/contact';

const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Prix Martinique - Contact')}`;

// Shared "Nous contacter" entry point: a plain mailto link opens the user's
// own default mail app (phone or laptop) pre-addressed and pre-subjected --
// no in-app form, no backend needed to receive messages.
const ContactLink = ({ className }) => (
  <a
    href={CONTACT_MAILTO}
    className={className || 'inline-flex items-center gap-2 text-orange-600 font-medium hover:underline'}
  >
    <Mail className="w-4 h-4" /> Nous contacter
  </a>
);

const PrivacyContent = () => (
  <>
    <p className="text-xs text-gray-400 mb-6">Dernière mise à jour : 29 août 2026</p>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">1. Qui sommes-nous</h3>
      <p className="text-gray-700 leading-relaxed">
        Prix Martinique est une application communautaire, gratuite et sans publicité, qui permet
        de comparer les prix des produits de consommation courante entre magasins de Martinique,
        et avec la France hexagonale.
      </p>
      <p className="text-gray-700 leading-relaxed">
        Prix Martinique et son domaine <strong>prix-martinique.org</strong> sont des modules du
        projet Vwa Pèp La. L'association Vwa Pèp La (nom de domaine : vwapepla.org) est en cours
        de constitution.
      </p>
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 space-y-1.5">
        <p><strong>Responsable du traitement :</strong> Jean-Marie Philocles / Association Vwa Pèp La (vwapepla.org — en cours de préparation et de constitution)</p>
        <p><strong>Adresse postale (temporaire) :</strong> Association Vwa Pèp La — c/o Jean-Marie Philocles — Sternenstrasse 21 — 8002 Zurich, Suisse. L'adresse définitive sera celle d'enregistrement de l'association.</p>
        <p><strong>Contact :</strong> {CONTACT_EMAIL}</p>
      </div>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">2. Données que nous collectons</h3>
      <div className="space-y-3">
        <div>
          <p className="font-medium text-gray-900">a) Données de compte (si vous créez un compte)</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Email et mot de passe (chiffré), ou identité Google si vous choisissez "Continuer avec
            Google" (nom, email, photo de profil transmis par Google) ; nom d'affichage, région, ville.
            <br /><em>Base légale : exécution du contrat (création et gestion de votre compte).</em>
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">b) Données de contribution</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Prix soumis, magasin, produit, photos du produit et de l'étiquette ; historique de vos
            scans, favoris, liste de courses, avis BQP, votes.
            <br /><em>Base légale : exécution du contrat (fonctionnement du service communautaire).</em>
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">c) Données de gamification</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Points, badges, niveau, classement.
            <br /><em>Base légale : exécution du contrat.</em>
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900">d) Données techniques et de mesure d'audience</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Type d'appareil (iOS/Android), utilisation en tant qu'application installée ou dans un
            navigateur, pages consultées, événements d'usage (via PostHog, hébergé dans l'Union
            européenne).
            <br /><em>Base légale : consentement (mesure d'audience) / intérêt légitime (sécurité,
            prévention de la fraude, statistiques agrégées).</em>
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 italic">
        Nous ne collectons jamais de données de paiement (l'application est gratuite) ni de
        géolocalisation précise sans action explicite de votre part (sélection manuelle de votre
        magasin/ville).
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">3. Destinataires de vos données</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Vos données sont hébergées et traitées par les sous-traitants suivants, dans le strict
        cadre de la fourniture du service :
      </p>
      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
        <li>Supabase (base de données, authentification) — hébergé dans l'UE (Irlande)</li>
        <li>Vercel Inc. (hébergement de l'application) — États-Unis, encadré par des clauses contractuelles types conformes au RGPD</li>
        <li>PostHog (mesure d'audience) — hébergé dans l'UE</li>
        <li>Google (uniquement si vous choisissez la connexion via Google)</li>
      </ul>
      <p className="text-sm text-gray-700 leading-relaxed">
        Nous ne vendons ni ne louons vos données personnelles à des tiers. Les prix que vous
        soumettez (produit, magasin, prix, date) sont partagés publiquement au sein de
        l'application, dans la mesure où c'est l'objet même du service ; votre nom d'affichage
        peut être visible à côté de vos contributions.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">4. Durée de conservation</h3>
      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
        <li>Données de compte : tant que votre compte est actif, puis 3 ans après la dernière connexion, sauf demande de suppression anticipée</li>
        <li>Données de contribution (prix, photos) : conservées même après suppression du compte, sous forme anonymisée, car elles constituent une donnée d'intérêt collectif</li>
        <li>Données de mesure d'audience : 14 mois maximum</li>
      </ul>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">5. Vos droits</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
        accès, rectification, effacement, limitation, portabilité, opposition. Vous pouvez les
        exercer en nous contactant à {CONTACT_EMAIL}. Nous répondrons dans un délai maximum d'un mois.
      </p>
      <p className="text-gray-700 leading-relaxed text-sm">
        Vous avez également le droit d'introduire une réclamation auprès de la Commission
        Nationale de l'Informatique et des Libertés (CNIL) — www.cnil.fr — si vous estimez que vos
        droits ne sont pas respectés.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">6. Cookies et traceurs</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        L'application utilise des traceurs strictement nécessaires (maintien de votre session de
        connexion), qui ne nécessitent pas votre consentement, et des traceurs de mesure
        d'audience (PostHog), soumis à votre consentement, que vous pouvez donner ou retirer à
        tout moment.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">7. Sécurité</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Vos données sont protégées par des règles d'accès strictes (Row Level Security) au niveau
        de la base de données : chaque utilisateur ne peut accéder qu'à ses propres données
        privées (favoris, historique), les données publiques (prix, produits) étant accessibles à
        tous par nature.
      </p>
    </section>

    <section className="space-y-3">
      <h3 className="font-bold text-lg text-gray-900">8. Contact</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Pour toute question relative à vos données personnelles :
      </p>
      <ContactLink />
    </section>
  </>
);

const MentionsLegalesContent = () => (
  <>
    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">1. Éditeur du site</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Prix Martinique (prix-martinique.org) est un module du projet Vwa Pèp La. L'association
        Vwa Pèp La (vwapepla.org) est en cours de constitution.
      </p>
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 space-y-1.5">
        <p><strong>Éditeur :</strong> Jean-Marie Philocles / Association Vwa Pèp La (vwapepla.org — en cours de préparation et de constitution)</p>
        <p><strong>Adresse (temporaire) :</strong> Association Vwa Pèp La — c/o Jean-Marie Philocles — Sternenstrasse 21 — 8002 Zurich, Suisse. L'adresse définitive sera celle d'enregistrement de l'association.</p>
        <p><strong>Email :</strong> {CONTACT_EMAIL}</p>
      </div>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">2. Directeur de la publication</h3>
      <p className="text-gray-700 leading-relaxed text-sm">Jean-Marie Philocles</p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">3. Hébergement</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        <strong>Hébergement de l'application (frontend) :</strong><br />
        Vercel Inc. — 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
      </p>
      <p className="text-gray-700 leading-relaxed text-sm">
        <strong>Hébergement de la base de données :</strong><br />
        Supabase Inc. — infrastructure hébergée en Irlande (Union européenne)
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">4. Propriété intellectuelle</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        La structure générale de l'application, ainsi que les textes, graphismes et éléments de
        conception qui la composent, sont la propriété de l'éditeur du site, sauf mention
        contraire. Toute reproduction non autorisée est interdite.
      </p>
      <p className="text-gray-700 leading-relaxed text-sm">
        Les données de prix, avis et contenus soumis par les utilisateurs ("contenus
        communautaires") restent la propriété de leurs auteurs, qui accordent à Prix Martinique
        une licence d'utilisation, de reproduction et de diffusion publique de ces contenus dans
        le cadre du fonctionnement du service.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">5. Contenus communautaires</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Prix Martinique est une plateforme collaborative : les prix, avis et signalements affichés
        sont soumis par les membres de la communauté et n'engagent pas la responsabilité de
        l'éditeur quant à leur exactitude. Nous mettons en œuvre des mécanismes de modération
        raisonnables (photos justificatives, signalement d'erreurs) mais ne pouvons garantir
        l'exactitude en temps réel de chaque donnée. Tout contenu manifestement erroné ou abusif
        peut nous être signalé et sera retiré dans les meilleurs délais.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">6. Données personnelles</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Le traitement des données personnelles est décrit dans notre Politique de confidentialité.
      </p>
    </section>

    <section className="space-y-3 mb-6">
      <h3 className="font-bold text-lg text-gray-900">7. Droit applicable</h3>
      <p className="text-gray-700 leading-relaxed text-sm">
        Les présentes mentions légales sont soumises au droit français. En cas de litige, les
        tribunaux français seront seuls compétents.
      </p>
    </section>

    <section className="space-y-3">
      <h3 className="font-bold text-lg text-gray-900">8. Contact</h3>
      <ContactLink />
    </section>
  </>
);

// type: 'privacy' | 'legal'
const LegalModal = ({ type, onClose }) => {
  const title = type === 'privacy' ? 'Politique de confidentialité' : 'Mentions légales';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[510] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] shadow-xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-5 text-white flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-white/80 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {type === 'privacy' ? <PrivacyContent /> : <MentionsLegalesContent />}
        </div>
      </div>
    </div>
  );
};

export { ContactLink };
export default LegalModal;
