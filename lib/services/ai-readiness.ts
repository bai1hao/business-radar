import { getAIProviderName } from './ai-provider';

export async function getAiReadiness(): Promise<{ ready: boolean; provider: string; message: string; models?: string[] }> {
  const provider = getAIProviderName();
  if (provider === 'glm' || provider === 'openai') {
    const configured = Boolean(process.env[provider === 'glm' ? 'GLM_API_KEY' : 'OPENAI_API_KEY']);
    return { ready: configured, provider, message: configured ? '已配置 API 密钥；尚未验证模型连接' : '尚未配置 API 密钥' };
  }

  const base = provider === 'lmstudio'
    ? process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1'
    : process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  const apiKey = provider === 'lmstudio' ? process.env.LM_STUDIO_API_KEY : process.env.OLLAMA_API_KEY;
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/models`, {
      signal: AbortSignal.timeout(3000), cache: 'no-store',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
    });
    if (response.status === 401 || response.status === 403) {
      return { ready: false, provider, message: provider === 'lmstudio' ? 'LM Studio 要求 API Token，请配置 LM_STUDIO_API_KEY' : '模型服务认证失败，请检查 API Key' };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { data?: Array<{ id?: string }> };
    const available = new Set((data.data || []).map(model => model.id));
    const chat = provider === 'lmstudio' ? process.env.LM_STUDIO_MODEL : process.env.OLLAMA_MODEL;
    const embedding = process.env.EMBEDDING_MODEL || (provider === 'lmstudio' ? process.env.LM_STUDIO_EMBEDDING_MODEL : process.env.OLLAMA_EMBEDDING_MODEL);
    const missing = [chat, embedding].filter(name => name && !available.has(name));
    const models = [...available].filter((id): id is string => Boolean(id));
    if (available.size === 0) return { ready: false, provider, message: '模型服务已连接，但未发现已加载模型', models };
    if (missing.length) return { ready: false, provider, message: `尚未加载配置的模型：${missing.join('、')}`, models };
    if (!chat || !embedding) return { ready: false, provider, message: '请配置聊天模型和 embedding 模型名称', models };
    return { ready: true, provider, message: '模型服务和所需模型已就绪', models };
  } catch {
    return { ready: false, provider, message: '无法连接本地模型服务，请先启动它' };
  }
}
