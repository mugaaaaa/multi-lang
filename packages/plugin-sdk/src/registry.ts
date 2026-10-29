import type { LanguageCode } from "@multi-lang/contracts";
import type {
  LanguagePack,
  MaterialImporter,
  PluginRegistry,
  PluginRegistration,
  ReviewScheduler,
} from "./index.js";

export class DuplicatePluginError extends Error {
  constructor(kind: string, id: string) {
    super(`plugin ${id} (${kind}) already registered`);
  }
}

export class PluginNotFoundError extends Error {
  readonly code = "plugin_not_found";

  constructor(kind: string, key: string) {
    super(`${kind} not registered: ${key}`);
  }
}

export class DefaultPluginRegistry implements PluginRegistry {
  private readonly languagePacks = new Map<LanguageCode, LanguagePack>();
  private readonly importers: MaterialImporter[] = [];
  private scheduler: ReviewScheduler | null = null;

  registerLanguagePack(pack: LanguagePack): PluginRegistration {
    if (this.languagePacks.has(pack.language)) {
      throw new DuplicatePluginError("language pack", pack.manifest.id);
    }
    this.languagePacks.set(pack.language, pack);
    return {
      dispose: () => {
        if (this.languagePacks.get(pack.language) === pack) {
          this.languagePacks.delete(pack.language);
        }
      },
    };
  }

  registerImporter(importer: MaterialImporter): PluginRegistration {
    this.importers.push(importer);
    return {
      dispose: () => {
        const index = this.importers.indexOf(importer);
        if (index >= 0) this.importers.splice(index, 1);
      },
    };
  }

  registerScheduler(scheduler: ReviewScheduler): PluginRegistration {
    this.scheduler = scheduler;
    return {
      dispose: () => {
        if (this.scheduler === scheduler) this.scheduler = null;
      },
    };
  }

  getLanguagePack(language: LanguageCode): LanguagePack {
    const pack = this.languagePacks.get(language);
    if (!pack) throw new PluginNotFoundError("language pack", language);
    return pack;
  }

  listLanguages() {
    return [...this.languagePacks.values()].map(({ language, displayName }) => ({
      language,
      displayName,
    }));
  }

  getScheduler(): ReviewScheduler {
    if (!this.scheduler) {
      throw new PluginNotFoundError("scheduler", "default");
    }
    return this.scheduler;
  }

  listImporters(): MaterialImporter[] {
    return [...this.importers];
  }
}
