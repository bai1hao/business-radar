import { logger } from './logger';
import { AIChatProvider, AIProviderName, createAIChatProvider } from './ai-provider';

// 深度分析结果接口
export interface DeepAnalysisResult {
  // 原有字段
  one_line_pain: string;
  paid_interest: 'High' | 'Medium' | 'Low';
  rationale: string;
  potential_product: string;

  // 维度1: 痛点验证度
  pain_depth: {
    surface_pain: string;
    root_causes: string[];
    user_scenarios: string[];
    emotional_intensity: number;
  };

  // 维度2: 竞品与机会
  market_landscape: {
    existing_solutions: Array<{
      name: string;
      limitation: string;
    }>;
    unmet_needs: string[];
    opportunity: string;
  };

  // 维度3: 可执行性
  mvp_plan: {
    core_features: string[];
    validation_hypotheses: Array<{
      hypothesis: string;
      test_method: string;
    }>;
    first_users: string;
    timeline: string;
    estimated_cost: string;
  };

  // 维度4: 优先级相关
  keyword_relevance: number;
  market_size_score: number;  // AI模型评估的市场规模 0-5
}

export class GLMService {
  private provider: AIChatProvider;
  private useThinking: boolean;

  constructor(providerOverride?: AIProviderName) {
    this.provider = createAIChatProvider(undefined, providerOverride);
    this.useThinking =
      this.provider.provider === 'glm' &&
      (this.provider.model.includes('4.6') || process.env.GLM_USE_THINKING === 'true');
  }

  async analyzeCluster(
    texts: string[],
    keywords: string[],
    dataSize: number,
    locale: string = 'zh'
  ): Promise<DeepAnalysisResult> {
    // 数据质量评估
    const qualityLevel = dataSize < 50 ? '小样本探索' :
                        dataSize < 200 ? '初步验证' : '可靠样本';

    const prompt = `你是顶级的创业导师和市场分析师。你的任务是帮助创业者/产品经理判断这个方向是否值得做。

【分析背景】
• 用户搜索关键词：「${keywords.join('、')}」
• 数据来源：该关键词相关的社交媒体内容和评论
• 数据规模：${dataSize}条（${qualityLevel}）

【核心任务】
从"需求验证"角度深度分析该聚类，帮助创业者做出"做/不做"的决策。

【分析维度】

1️⃣ 痛点深度挖掘（pain_depth）
- surface_pain: 表面痛点是什么？（一句话）
- root_causes: 连问3个"为什么"，找到根本原因（数组，3个字符串）
- user_scenarios: 这是什么场景下的痛点？（数组，1-3个场景）
- emotional_intensity: 用户情绪强度评分（0-5，0=无感，5=极度强烈）

2️⃣ 市场与竞品分析（market_landscape）
- existing_solutions: 现有解决方案（数组，2-3个，格式：{name, limitation}）
  注意：基于你的知识库分析，如果不确定请说明"需要进一步调研"
- unmet_needs: 哪些需求尚未被满足？（数组，2-3个字符串）
- opportunity: 市场机会在哪里？（一句话）

3️⃣ MVP执行方案（mvp_plan）
- core_features: 核心功能（数组，3-5个，一句话说清）
- validation_hypotheses: 需要验证的假设（数组，2-3个，格式：{hypothesis, test_method}）
- first_users: 第一批用户从哪来？（一句话）
- timeline: 预估开发时间（如"2周开发+1周测试"）
- estimated_cost: 预估成本（如"1000元广告投放"）

4️⃣ 市场规模评估（market_size_score）
- 该痛点的潜在市场规模有多大？（0-5分）
  0=极小众（几千人）、1=小众（几万人）、2=中等（几十万人）、3=较大（百万级）、4=大众（千万级）、5=超大众（亿级）
- 基于你的知识判断受众人群大小，考虑：目标用户群体规模、需求频次、地域覆盖

5️⃣ 相关度评估（keyword_relevance）
- 该聚类与「${keywords.join('、')}」的相关度？（0-100分）
- 如果<50分，说明为什么相关度低

【分析原则】
✓ 只分析与「${keywords.join('、')}」相关的内容，过滤无关话题
✓ 不要停留在表面，深挖底层需求（时间、信任、能力、成本）
✓ 产品方案要具体可执行，不要空洞概念
✓ 竞品分析基于你的知识，不确定的标注"需进一步调研"
✓ 如果数据量小（${dataSize}<50），在相关字段中提醒"需要更多数据验证"
✓ 付费意愿必须有原文证据；仅有重复痛点或想要某功能，不能评为 High
✓ 原文没有明确的购买、付费或预算表态时，将 paid_interest 设为 Medium，并说明尚需验证
✓ MVP方案要接地气，不要假大空

【待分析文本】
${texts.join('\n\n')}

【输出格式】
严格返回JSON格式，包含以下所有字段：
{
  "one_line_pain": "核心痛点一句话总结",
  "paid_interest": "High/Medium/Low",
  "rationale": "判断理由，引用原文",
  "potential_product": "产品概念一句话",
  "pain_depth": {
    "surface_pain": "表面痛点",
    "root_causes": ["为什么1", "为什么2", "为什么3"],
    "user_scenarios": ["场景1", "场景2"],
    "emotional_intensity": 3
  },
  "market_landscape": {
    "existing_solutions": [
      {"name": "产品A", "limitation": "局限性"},
      {"name": "产品B", "limitation": "局限性"}
    ],
    "unmet_needs": ["未满足需求1", "未满足需求2"],
    "opportunity": "市场机会描述"
  },
  "mvp_plan": {
    "core_features": ["功能1", "功能2", "功能3"],
    "validation_hypotheses": [
      {"hypothesis": "假设1", "test_method": "测试方法1"},
      {"hypothesis": "假设2", "test_method": "测试方法2"}
    ],
    "first_users": "用户获取渠道",
    "timeline": "时间预估",
    "estimated_cost": "成本预估"
  },
  "market_size_score": 3,
  "keyword_relevance": 85
}

请确保返回的是纯JSON格式，不要包含markdown代码块标记。

【输出语言】
请使用${locale === 'en' ? '英文' : '中文'}输出所有分析内容（JSON字段名保持英文不变，只翻译字段值）。`;

    try {
      const content = await this.provider.complete(
        [
          {
            role: 'system',
            content: '你是一个专业的市场分析师，擅长从用户评论中提取痛点并评估商业价值。请严格按照JSON格式返回结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        this.useThinking
          ? {
              extraBody: { thinking: { type: 'enabled' } },
              maxTokens: 65536,
              temperature: 1.0
            }
          : {
              temperature: 0.6
            }
      );

      // 尝试解析JSON响应
      try {
        // 清理可能的markdown格式
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```\s*/, '').replace(/```\s*$/, '');
        }

        const parsed = JSON.parse(cleanContent);

        // 验证必需字段
        // 验证并填充默认值
        const claimedInterest = ['High', 'Medium', 'Low'].includes(parsed.paid_interest) ? parsed.paid_interest : 'Medium';
        const paymentEvidence = texts.some(text => /付费|愿意花|愿意买|花钱|购买|订阅|预算|报价|价格|多少钱|收费|买一个/.test(text));
        const paidInterest = claimedInterest === 'High' && !paymentEvidence ? 'Medium' : claimedInterest;
        const rationale = parsed.rationale || '基于用户评论内容分析';
        const result: DeepAnalysisResult = {
          one_line_pain: parsed.one_line_pain || '用户存在某种需求痛点',
          paid_interest: paidInterest as 'High' | 'Medium' | 'Low',
          rationale: paidInterest !== claimedInterest ? `${rationale}；原文未见明确付费表态，付费意愿需进一步验证` : rationale,
          potential_product: parsed.potential_product || '针对用户需求的解决方案',

          pain_depth: {
            surface_pain: parsed.pain_depth?.surface_pain || parsed.one_line_pain || '痛点待分析',
            root_causes: parsed.pain_depth?.root_causes || ['根因待深挖'],
            user_scenarios: parsed.pain_depth?.user_scenarios || ['使用场景待明确'],
            emotional_intensity: typeof parsed.pain_depth?.emotional_intensity === 'number'
              ? parsed.pain_depth.emotional_intensity
              : 2
          },

          market_landscape: {
            existing_solutions: parsed.market_landscape?.existing_solutions || [
              { name: '待调研', limitation: '竞品信息需进一步收集' }
            ],
            unmet_needs: parsed.market_landscape?.unmet_needs || ['待识别未满足需求'],
            opportunity: parsed.market_landscape?.opportunity || '市场机会待评估'
          },

          mvp_plan: {
            core_features: parsed.mvp_plan?.core_features || ['核心功能待设计'],
            validation_hypotheses: parsed.mvp_plan?.validation_hypotheses || [
              { hypothesis: '用户需求假设', test_method: '测试方法待定' }
            ],
            first_users: parsed.mvp_plan?.first_users || '用户获取渠道待规划',
            timeline: parsed.mvp_plan?.timeline || '时间待评估',
            estimated_cost: parsed.mvp_plan?.estimated_cost || '成本待评估'
          },

          keyword_relevance: typeof parsed.keyword_relevance === 'number'
            ? parsed.keyword_relevance
            : 50,

          market_size_score: typeof parsed.market_size_score === 'number'
            ? Math.min(5, Math.max(0, parsed.market_size_score))
            : 2.5  // 默认中等规模
        };

        return result;

      } catch (parseError) {
        logger.error('JSON解析失败:', parseError);
        logger.debug('原始响应:', content);
        throw new Error('AI 返回内容不是有效 JSON，请重试分析');
      }
    } catch (apiError) {
      logger.error(`${this.provider.provider} API调用失败:`, apiError instanceof Error ? apiError.message : '未知错误');
      throw apiError;
    }
  }
}
