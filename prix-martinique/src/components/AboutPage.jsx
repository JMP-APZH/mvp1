import React, { useState } from 'react';
import { Heart, Users, Lightbulb, Target, Share2, BookOpen, ShieldCheck, Megaphone, ChevronLeft, ArrowRight, Star } from 'lucide-react';

const AboutPage = () => {
  const [view, setView] = useState('landing'); // 'landing', 'philosophy', 'rules'

  const SubHeader = ({ title }) => (
    <div
      onClick={() => setView('landing')}
      className="flex items-center gap-4 mb-6 sticky top-[61px] bg-white py-4 z-[50] border-b border-gray-100 -mx-6 px-6 cursor-pointer hover:bg-gray-50 transition-colors group"
    >
      <div className="p-2 group-hover:bg-gray-100 rounded-full transition-colors">
        <ChevronLeft className="w-6 h-6 text-gray-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 flex-1">{title}</h2>
    </div>
  );

  if (view === 'landing') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div className="sticky top-[61px] bg-white py-4 z-[50] border-b border-gray-100 -mx-6 px-6 mb-4">
          <h1 className="text-2xl font-bold text-center leading-tight">
            Notre <span className="text-red-600">engagement</span> communautaire
          </h1>
          <div className="flex justify-center gap-2 mt-2">
            <div className="w-12 h-1 bg-red-600 rounded"></div>
            <div className="w-12 h-1 bg-green-600 rounded"></div>
            <div className="w-12 h-1 bg-black rounded"></div>
          </div>
        </div>

        <div className="text-center mb-8">
          <p className="text-gray-600 italic">
            "Tousèl nou pa ka pézé ayen, sé ansanm nou pi fò"
          </p>
        </div>

        <div className="grid gap-6">
          <button
            onClick={() => setView('philosophy')}
            className="group relative bg-white border-2 border-orange-100 hover:border-orange-500 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left overflow-hidden"
          >
            <div className="absolute right-0 top-0 opacity-5 -mr-4 -mt-4 group-hover:scale-110 transition-transform">
              <Lightbulb className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors">
                <Lightbulb className="w-7 h-7 text-orange-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Notre Philosophie</h3>
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                Découvrez la vision de prospérité et d'autonomie qui porte ce projet pour la Martinique.
              </p>
              <div className="flex items-center text-orange-600 font-bold text-sm">
                Découvrir <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setView('rules')}
            className="group relative bg-white border-2 border-red-500 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left overflow-hidden bg-gradient-to-br from-white to-red-50/30"
          >
            <div className="absolute right-0 top-0 opacity-5 -mr-4 -mt-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-red-200">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Citoyens Conscients & Activistes</h3>
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                Les règles fondamentales et les avantages de notre action collective contre la vie chère.
              </p>
              <div className="flex items-center text-red-600 font-bold text-sm">
                Rejoindre le combat <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        <div className="pt-12 border-t border-gray-100 text-center">
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-red-600 rounded-full"></div>
            <div className="w-8 h-8 bg-green-600 rounded-full"></div>
            <div className="w-8 h-8 bg-black rounded-full"></div>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
            Martinique Consciente • 2026
          </p>
        </div>
      </div>
    );
  }

  if (view === 'rules') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <SubHeader title="Règles & Avantages" />

        <div className="bg-red-600 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-20 -mr-6 -mb-6">
            <Megaphone className="w-32 h-32" />
          </div>
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            🚨 L'Appel des Citoyens Conscients
          </h3>
          <p className="text-red-50 leading-relaxed font-medium">
            Ce n'est pas qu'une application de prix. C'est un instrument de pression populaire et de transparence totale.
          </p>
        </div>

        <section className="space-y-6">
          <h3 className="font-bold text-xl text-gray-900 border-b-2 border-red-100 pb-2">🛡️ Règles du "Chasseur"</h3>
          <div className="grid gap-4">
            <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-2xl">📸</div>
              <div>
                <h4 className="font-bold text-gray-800">Preuve par l'image</h4>
                <p className="text-sm text-gray-600">Toujours photographier l'étiquette en rayon. Une donnée sans photo est une donnée qui peut être contestée.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-2xl">⚡</div>
              <div>
                <h4 className="font-bold text-gray-800">Donnée en temps réel</h4>
                <p className="text-sm text-gray-600">Publiez votre prix immédiatement. Un prix de la semaine dernière n'est plus utile au consommateur d'aujourd'hui.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-2xl">🤝</div>
              <div>
                <h4 className="font-bold text-gray-800">Zéro manipulation</h4>
                <p className="text-sm text-gray-600">Nous luttons contre les fausses promos. Signalez les erreurs d'étiquetage pour protéger la communauté.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-bold text-xl border-b-2 border-green-100 pb-2 text-green-700">💎 Vos avantages d'Activiste</h3>
          <div className="grid gap-4">
            <div className="p-5 bg-green-50 rounded-2xl border border-green-100">
              <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                <Target className="w-5 h-5" /> Pouvoir de boycott ciblé
              </h4>
              <p className="text-sm text-green-800">
                Grâce aux statistiques communautaires, nous identifions instantanément les abus et pouvons orienter nos achats vers les enseignes qui respectent réellement le consommateur.
              </p>
            </div>
            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" /> Influence Collective
              </h4>
              <p className="text-sm text-blue-800">
                Chaque prix scanné est une donnée qui sert aux associations et aux collectifs pour prouver la réalité de la vie chère avec des faits indiscutables.
              </p>
            </div>
            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
              <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                <Star className="w-5 h-5" /> Récompense de l'expertise
              </h4>
              <p className="text-sm text-amber-800">
                Gagnez en influence au sein de la communauté. Vos signalements "BQP" validés font de vous un expert reconnu de la consommation consciente.
              </p>
            </div>
          </div>
        </section>

        <div className="bg-gray-900 text-white p-8 rounded-3xl text-center space-y-4">
          <h4 className="text-2xl font-bold">"Batjé a boy' é pa pèd fwa"</h4>
          <p className="text-gray-400">
            Votre smartphone est votre arme. Utilisez-la pour la transparence et la justice sociale.
          </p>
          <button
            onClick={() => setView('landing')}
            className="bg-white text-gray-900 px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors"
          >
            Compris !
          </button>
        </div>
      </div>
    );
  }

  if (view === 'philosophy') {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
        <SubHeader title="Notre Philosophie" />
        {/* Hero Section with RVN Colors */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 leading-tight">
            Notre{' '}
            <span className="text-red-600">aspiration</span>
            {' '}pour la{' '}
            <span className="text-green-600">Martinique</span>
            {' '}et sa{' '}
            <span className="text-black font-extrabold">population</span>
          </h1>

          {/* RVN Visual Indicator */}
          <div className="flex justify-center gap-2 my-4">
            <div className="w-16 h-1 bg-red-600 rounded"></div>
            <div className="w-16 h-1 bg-green-600 rounded"></div>
            <div className="w-16 h-1 bg-black rounded"></div>
          </div>
        </div>

        {/* Core Philosophy */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-r-lg">
          <p className="text-lg text-gray-800 leading-relaxed font-medium">
            Une communauté qui prospère a pris en main les outils de son développement.
          </p>
        </div>

        <div className="prose prose-lg">
          <p className="text-gray-700 leading-relaxed">
            Une telle communauté devient actrice de son propre avenir en utilisant ses ressources
            (compétences, outils technologiques, collaboration) pour identifier ses besoins et
            mettre en œuvre ses solutions, favorisant ainsi l'autonomie, l'engagement et la
            résilience collective.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <p className="text-gray-800 leading-relaxed">
            L'application que vous avez en main devient un tel outil lorsque la population
            se l'approprie et tire parti idéalement et optimalement des évolutions suivantes :
          </p>
        </div>

        {/* Pillars Section */}
        <div className="space-y-6">
          {/* Participation */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                La participation et la collaboration
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Nous engageons les membres motivé·e·s dans la prise de décision et la mise en
                œuvre de projets (ateliers, groupes de travail).
              </p>
            </div>
          </div>

          {/* Communication */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                La communication
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Des canaux ouverts sont mis en place pour partager des informations et des
                valeurs communes.
              </p>
            </div>
          </div>

          {/* Resources */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                Les ressources partagées
              </h3>
              <p className="text-gray-700 leading-relaxed">
                De nos coopérations naîtront davantage de bibliothèques d'outils et de
                plateformes d'échange de connaissances.
              </p>
            </div>
          </div>

          {/* Social Bonds */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                Le renforcement des liens sociaux
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Premièrement digitaux, nos liens et intérêts pourront évoluer vers l'organisation
                d'événements et d'activités pour renforcer notre sentiment d'appartenance et de sécurité.
              </p>
            </div>
          </div>

          {/* Research */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                La recherche et l'apprentissage
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Analyser les problèmes locaux pour trouver des solutions adaptées, souvent via
                des approches participatives sous forme de groupes de réflexion, laboratoire d'idées
                afin de favoriser et d'encourager la recherche et développement et mettre en place
                des solutions pratiques et efficaces, renforçant ainsi notre sentiment de fierté
                devant ce que nous accomplissons ensemble.
              </p>
            </div>
          </div>

          {/* Innovation */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                L'innovation
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Notre coopération active repoussera les limites honteuses du "i bon kon sa" et
                nous serons à même de développer des initiatives communes pour résoudre des enjeux
                spécifiques, et pour beaucoup déjà très urgents.
              </p>
            </div>
          </div>
        </div>

        {/* Conclusion */}
        <div className="bg-gradient-to-r from-red-500 via-green-500 to-gray-900 text-white p-6 rounded-lg">
          <p className="text-lg leading-relaxed font-medium">
            En bref, une communauté qui prospère ne se contente pas de recevoir de l'aide,
            elle prend les rênes en mobilisant ses membres et en s'appropriant les moyens
            nécessaires pour construire son propre progrès, renforçant ainsi son bien-être
            et sa capacité à s'adapter.
          </p>
        </div>

        <div className="text-center bg-orange-50 border border-orange-200 rounded-lg p-6">
          <p className="text-gray-900 font-semibold text-lg mb-4">
            C'est avec cette philosophie que ce projet sera mené.
            Toutes les bonnes volontés et initiatives seront sollicitées et les bienvenues.
          </p>
        </div>

        {/* Kréyol Call to Action */}
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-orange-400 rounded-xl p-6 text-center">
          <p className="text-xl font-bold text-gray-900 mb-3 italic">
            Sa ki las' atann', Batjé a boy' é pa pèd fwa !
          </p>
          <p className="text-lg font-semibold text-orange-700 italic">
            Ladjé "i bon kon sa" a é koumansé swèf wè nou vansé
          </p>
        </div>

        {/* Footer Actions */}
        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            Rejoignez le mouvement • Ensemble contre la vie chère
          </p>
          <div className="flex justify-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-full"></div>
            <div className="w-8 h-8 bg-green-600 rounded-full"></div>
            <div className="w-8 h-8 bg-black rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return null; // Should never happen given the logic above
};

export default AboutPage;
