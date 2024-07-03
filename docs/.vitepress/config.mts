import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Documentation",
  description: "",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'remoteStorage.js', link: '/' },
    ],

    sidebar: [
      {
        text: 'remoteStorage.js', link: '/',
        items: [
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Why use this?', link: '/why' },
          {
            text: 'Getting started', link: '/getting-started/',
            collapsed: true,
            items: [
              { text: 'Adding rs.js to an app', link: '/getting-started/how-to-add' },
              { text: 'Initialization & configuration', link: '/getting-started/initialize-and-configure' },
              { text: 'Using the connect widget add-on', link: '/getting-started/connect-widget' },
              { text: 'Handling events', link: '/getting-started/events' },
              { text: 'Reading and writing data', link: '/getting-started/read-and-write-data' },
            ]
          },
          {
            text: 'Data modules', link: '/data-modules/',
            collapsed: true,
            items: [
              { text: 'Defining a module', link: '/data-modules/defining-a-module' },
              { text: 'Defining data types', link: '/data-modules/defining-data-types' },
              { text: 'Publishing and finding modules', link: '/data-modules/publishing-and-finding-modules' },
            ]
          },
          { text: 'Usage with Node.js', link: '/nodejs' },
          { text: 'Usage in Cordova apps', link: '/cordova' },
          { text: 'Usage with TypeScript', link: '/typescript' },
          { text: 'Dropbox and Google Drive', link: '/dropbox-and-google-drive' },
        ]
      },
      {
        text: 'JavaScript API', link: '/api',
        items: [
          { text: 'RemoteStorage', link: '/api/remotestorage/classes/RemoteStorage' },
          { text: 'BaseClient', link: '/api/baseclient/classes/BaseClient' },
          { text: 'Access', link: '/api/access/classes/Access' },
          { text: 'Caching', link: '/api/caching/classes/Caching' },
        ]
      },
      {
        text: 'Contributing', link: '/contributing/',
        collapsed: true,
        items: [
          { text: 'Code overview', link: '/contributing/code-overview' },
          { text: 'Building', link: '/contributing/building' },
          { text: 'Testing', link: '/contributing/testing' },
          { text: 'Documentation', link: '/contributing/docs' },
          { text: 'GitHub workflow', link: '/contributing/github-flow' },
          { text: 'Release checklist', link: '/contributing/release-checklist' },
          { text: 'Library internals', link: '/contributing/internals/',
            collapsed: true,
            items: [
              { text: 'Discovery bootstrap', link: '/contributing/internals/discovery-bootstrap' },
              { text: 'Caching', link: '/contributing/internals/caching' },
              { text: 'Data format of the local cache', link: '/contributing/internals/cache-data-format' },
            ]
          },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/remotestorage/remotestorage.js' }
    ]
  }
})
