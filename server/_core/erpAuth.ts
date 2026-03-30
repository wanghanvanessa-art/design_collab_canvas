/**
 * ERP Authentication Module
 *
 * 对接京东 ERP 登录接口。
 * 目前使用「本地模拟」模式，等拿到正式 ERP API 文档后，
 * 只需修改 callErpLoginApi() 函数即可完成真实对接。
 *
 * 配置方式（.env 或环境变量）：
 *   ERP_API_URL=https://erp.jd.com/api/login   ← ERP 登录接口地址
 *   ERP_MOCK=true                               ← 设为 true 使用本地模拟（开发期）
 */

import axios from "axios";

const ERP_API_URL = process.env.ERP_API_URL ?? "";
const ERP_MOCK = !ERP_API_URL || process.env.ERP_MOCK === "true";

export interface ErpUser {
  /** ERP 工号，作为唯一标识 */
  erpin: string;
  /** 真实姓名 */
  name: string;
  /** 邮箱（可选）*/
  email?: string;
  /** 部门（可选）*/
  department?: string;
}

/**
 * 调用 ERP 接口验证账号密码。
 * 返回 ErpUser 表示成功，抛出 Error 表示失败。
 *
 * ★ 正式对接时修改此函数 ★
 */
async function callErpLoginApi(username: string, password: string): Promise<ErpUser> {
  if (ERP_MOCK) {
    // ── 本地模拟模式 ────────────────────────────────────────────────
    // 任意工号 + 密码不为空即可登录，方便本地开发测试
    if (!username || !password) {
      throw new Error("用户名和密码不能为空");
    }
    return {
      erpin: username,
      name: username,          // 真实场景下 ERP 会返回姓名
      email: `${username}@jd.com`,
      department: "设计中台",
    };
  }

  // ── 真实 ERP 接口调用 ────────────────────────────────────────────
  // 根据你们 ERP 文档调整请求格式（headers / body / 字段名等）
  try {
    const { data } = await axios.post(
      ERP_API_URL,
      { username, password },   // ← 按 ERP 文档修改参数名
      { timeout: 8000 }
    );

    // ← 按 ERP 返回结构修改字段映射
    if (!data || data.code !== 0) {
      throw new Error(data?.message ?? "ERP 验证失败");
    }

    return {
      erpin:      data.data?.erpin ?? data.data?.username ?? username,
      name:       data.data?.name  ?? data.data?.realName ?? username,
      email:      data.data?.email ?? `${username}@jd.com`,
      department: data.data?.department ?? "",
    };
  } catch (err: any) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw new Error("ERP 服务连接失败，请检查网络或联系管理员");
  }
}

export { callErpLoginApi, ERP_MOCK };