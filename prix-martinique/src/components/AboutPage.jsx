import { Heart, Users, Lightbulb, Target, Share2, BookOpen } from 'lucide-react';

const AboutPage = () => {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
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
};

export default AboutPage;
