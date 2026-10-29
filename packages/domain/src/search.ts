import type {
  LanguageCode,
  SearchInput,
  SearchResultItem,
} from "@multi-lang/contracts";
import type { LanguagePack } from "@multi-lang/plugin-sdk";
import type { SearchRepository, Storage } from "./storage.js";
import { DomainError, planNotFound, type SearchService } from "./services.js";

export class DefaultSearchService implements SearchService {
  constructor(
    private readonly storage: Storage,
    private readonly searchRepository: SearchRepository,
    private readonly languagePack: (language: LanguageCode) => LanguagePack,
  ) {}

  async search(
    ownerId: string,
    input: SearchInput,
  ): Promise<SearchResultItem[]> {
    const plan = await this.storage.unitOfWork.execute((repos) =>
      repos.plans.findById(ownerId, input.planId),
    );
    if (!plan) throw planNotFound(input.planId);
    if (input.language && input.language !== plan.language) {
      throw new DomainError("plan_language_mismatch", "检索语言必须与学习计划一致");
    }
    const pack = this.languagePack(plan.language);
    const query = pack.normalizeText(input.query, "original");
    if (!query) return [];
    return this.searchRepository.search(ownerId, {
      ...input,
      query,
      language: plan.language,
      fullTextParser: pack.searchConfig.fullTextParser,
    });
  }
}
