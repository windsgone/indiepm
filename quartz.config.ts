import { QuartzConfig } from "./quartz/cfg"
import { byDateAndAlphabetical } from "./quartz/components/PageList"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const configuration: QuartzConfig["configuration"] = {
  pageTitle: "Indie PM",
  pageTitleSuffix: "",
  enableSPA: true,
  enablePopovers: false,
  analytics: {
    provider: "plausible",
  },
  locale: "en-US",
  baseUrl: "windsgone.github.io/indiepm",
  ignorePatterns: ["private", "templates", ".obsidian"],
  defaultDateType: "published",
  theme: {
    fontOrigin: "googleFonts",
    cdnCaching: true,
    typography: {
      title: "Noto Sans SC",
      header: "Noto Sans SC",
      body: "Noto Sans SC",
      code: "IBM Plex Mono",
    },
    colors: {
      lightMode: {
        light: "#F5F5F5",
        lightgray: "#EEEEEE",
        gray: "#D1D1D1",
        darkgray: "#6C6C6C",
        dark: "#1E1E1E",
        secondary: "#286EE0",
        tertiary: "#1B5FCC",
        highlight: "rgba(40, 110, 224, 0.10)",
        textHighlight: "rgba(255, 230, 128, 0.45)",
      },
      darkMode: {
        light: "#0F1114",
        lightgray: "#1C1F24",
        gray: "#2B3036",
        darkgray: "#C7CDD4",
        dark: "#F4F6F8",
        secondary: "#8DA3BF",
        tertiary: "#6F86A6",
        highlight: "rgba(141, 163, 191, 0.12)",
        textHighlight: "rgba(255, 225, 128, 0.30)",
      },
    },
  },
}

const config: QuartzConfig = {
  configuration,
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest", openLinksInNewTab: true }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage({
        sort: byDateAndAlphabetical(configuration),
      }),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
