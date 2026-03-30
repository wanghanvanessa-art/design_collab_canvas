/**
 * 全局登录弹窗控制器
 * 任何组件调用 openLoginModal() 即可弹出登录框，无需 prop 传递。
 */

type Listener = () => void;
let _listener: Listener | null = null;

export function registerLoginModal(fn: Listener) {
  _listener = fn;
}

export function openLoginModal() {
  _listener?.();
}