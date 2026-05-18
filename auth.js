(function () {
    const ACCESS_TOKEN_KEY = 'pageviewer.accessToken';
    const REFRESH_TOKEN_KEY = 'pageviewer.refreshToken';
    const PENDING_EMAIL_KEY = 'pageviewer.pendingVerificationEmail';
    const POST_LOGIN_REDIRECT_KEY = 'pageviewer.postLoginRedirect';
    const inferApiBaseUrl = () => {
        if (window.PAGEVIEWER_API_BASE_URL) {
            return window.PAGEVIEWER_API_BASE_URL;
        }

        const hostname = window.location.hostname;
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1'
        ) {
            return 'http://localhost:3001';
        }

        if (hostname === 'dev.pageviewer.ru') {
            return 'https://dev-api.pageviewer.ru';
        }

        return 'https://api.pageviewer.ru';
    };

    const API_BASE_URL = inferApiBaseUrl().replace(/\/$/, '');
    let refreshInFlight = null;
    let pricingCache = null;

    const messages = {
        email_already_registered: 'Этот email уже зарегистрирован. Войдите или восстановите пароль.',
        invalid_credentials: 'Неверный email или пароль.',
        email_not_verified: 'Email не подтвержден. Проверьте почту или отправьте письмо повторно.',
        invalid_or_expired_token: 'Ссылка недействительна или устарела.',
        invalid_refresh_token: 'Сессия истекла. Войдите снова.',
        not_implemented: 'Скачивание через сайт пока не настроено на сервере.',
        payments_not_configured: 'Оплата пока не настроена на сервере.',
        payment_provider_error: 'Не удалось создать платёж. Попробуйте чуть позже.',
        payment_provider_unavailable: 'Платёжный сервис временно недоступен. Попробуйте позже.',
        order_not_found: 'Заказ не найден.',
        order_not_found_for_payment: 'Не удалось сопоставить платёж с заказом.',
        forbidden_order_access: 'У вас нет доступа к этому заказу.',
        license_not_found: 'Лицензия не найдена.',
        forbidden_license_access: 'У вас нет доступа к этой лицензии.',
        license_key_email_unavailable: 'Для этой лицензии повторная отправка ключа пока недоступна.',
        network_error: 'Не удалось связаться с сервером. Попробуйте позже.',
        validation_error: 'Проверьте заполнение формы.',
        unknown_error: 'Что-то пошло не так. Попробуйте позже.',
    };

    const tokenStore = {
        get accessToken() {
            return localStorage.getItem(ACCESS_TOKEN_KEY);
        },
        get refreshToken() {
            return localStorage.getItem(REFRESH_TOKEN_KEY);
        },
        setTokens(tokens) {
            if (tokens?.accessToken) {
                localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
            }
            if (tokens?.refreshToken) {
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
            }
        },
        clear() {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        },
        isAuthenticated() {
            return Boolean(this.accessToken && this.refreshToken);
        },
    };

    const decodeJwtPayload = (token) => {
        if (!token || !token.includes('.')) return null;
        try {
            const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(payload)
                    .split('')
                    .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
                    .join(''),
            );
            return JSON.parse(json);
        } catch {
            return null;
        }
    };

    const isAccessTokenExpired = () => {
        const payload = decodeJwtPayload(tokenStore.accessToken);
        if (!payload?.exp) return false;
        return payload.exp * 1000 <= Date.now() + 15000;
    };

    const normalizeError = (error, fallbackStatus) => {
        if (error?.normalized) return error;
        if (error instanceof TypeError) {
            return {
                normalized: true,
                status: 0,
                code: 'network_error',
                message: messages.network_error,
                details: {},
            };
        }

        const response = error || {};
        const rawMessage = Array.isArray(response.message) ? response.message.join(', ') : response.message;
        const code = response.code || rawMessage || response.error || 'unknown_error';
        const status = response.statusCode || response.status || fallbackStatus || 0;
        return {
            normalized: true,
            status,
            code,
            message: messages[code] || (status === 400 ? messages.validation_error : messages.unknown_error),
            details: response,
        };
    };

    const shouldReauthenticate = (error) => {
        const normalized = normalizeError(error);
        return normalized.code === 'invalid_refresh_token';
    };

    const parseResponse = async (response) => {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            return { message: text };
        }
    };

    const apiRequest = async (path, options = {}) => {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {}),
        };

        const requestOptions = {
            method: options.method || 'GET',
            headers,
            cache: options.cache,
        };

        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            requestOptions.body = JSON.stringify(options.body);
        }

        if (options.auth) {
            const token = await getValidAccessToken();
            headers.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
        } catch (error) {
            throw normalizeError(error);
        }

        const payload = await parseResponse(response);
        if (!response.ok) {
            throw normalizeError({ ...payload, status: response.status }, response.status);
        }

        return payload;
    };

    const getValidAccessToken = async () => {
        if (!tokenStore.refreshToken) {
            throw normalizeError({ message: 'invalid_refresh_token', status: 401 });
        }

        if (tokenStore.accessToken && !isAccessTokenExpired()) {
            return tokenStore.accessToken;
        }

        if (!refreshInFlight) {
            refreshInFlight = (async () => {
                try {
                    const data = await apiRequest('/auth/refresh', {
                        method: 'POST',
                        body: { refreshToken: tokenStore.refreshToken },
                    });
                    tokenStore.setTokens({ accessToken: data.accessToken });
                    return data.accessToken;
                } catch (error) {
                    if (shouldReauthenticate(error)) {
                        tokenStore.clear();
                    }
                    throw normalizeError(error);
                } finally {
                    refreshInFlight = null;
                }
            })();
        }

        return refreshInFlight;
    };

    const getUser = () => decodeJwtPayload(tokenStore.accessToken);

    const resolveAppUrl = (url) => {
        const target = url || '/';
        if (window.location.protocol !== 'file:' || !target.startsWith('/')) {
            return target;
        }

        if (target === '/') {
            return 'index.html';
        }

        if (target.startsWith('/#')) {
            return `index.html${target.slice(1)}`;
        }

        return target.slice(1);
    };

    const savePostLoginRedirect = (url) => {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, resolveAppUrl(url));
    };

    const consumePostLoginRedirect = () => {
        const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
        sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
        return resolveAppUrl(value);
    };

    const detectPlatform = () => {
        const source = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
        if (source.includes('mac')) return 'macos';
        if (source.includes('win')) return 'windows';
        return '';
    };

    const startValueTicker = (node, options = {}) => {
        if (!node) return () => {};

        const values = Array.isArray(options.values) && options.values.length
            ? options.values
            : [888, 1088, 988, 1188];
        const formatValue = options.formatValue || ((value) => String(value));
        let index = 0;

        node.classList.add('pricing-ticker');
        node.textContent = formatValue(values[index]);

        const timer = window.setInterval(() => {
            index = (index + 1) % values.length;
            node.textContent = formatValue(values[index]);
        }, options.intervalMs || 180);

        return (finalText) => {
            window.clearInterval(timer);
            node.classList.remove('pricing-ticker');
            if (finalText !== undefined) {
                node.textContent = finalText;
            }
        };
    };

    const startDownload = async (platform) => {
        const data = await apiRequest('/downloads/app', {
            method: 'POST',
            auth: true,
            body: { platform },
        });
        const url = data.downloadUrl || data.signedUrl || data.url;
        if (!url) {
            const code = data.status || 'unknown_error';
            throw normalizeError({ message: code, status: 400, ...data });
        }
        window.location.href = url;
        return data;
    };

    const logout = async () => {
        const refreshToken = tokenStore.refreshToken;
        try {
            if (refreshToken) {
                await apiRequest('/auth/logout', {
                    method: 'POST',
                    body: { refreshToken },
                });
            }
        } finally {
            tokenStore.clear();
        }
    };

    const getPricing = async (options = {}) => {
        if (!options.force && pricingCache) {
            return pricingCache;
        }

        const cacheBuster = options.force ? `?t=${Date.now()}` : '';
        const data = await apiRequest(`/public/pricing${cacheBuster}`, {
            cache: 'no-store',
        });
        pricingCache = data;
        return data;
    };

    window.PageViewerAuth = {
        API_BASE_URL,
        keys: {
            pendingEmail: PENDING_EMAIL_KEY,
            postLoginRedirect: POST_LOGIN_REDIRECT_KEY,
        },
        messages,
        normalizeError,
        shouldReauthenticate,
        resolveAppUrl,
        apiRequest,
        setTokens: tokenStore.setTokens.bind(tokenStore),
        clearTokens: tokenStore.clear.bind(tokenStore),
        isAuthenticated: tokenStore.isAuthenticated.bind(tokenStore),
        getAccessToken: () => tokenStore.accessToken,
        getRefreshToken: () => tokenStore.refreshToken,
        getUser,
        getValidAccessToken,
        savePostLoginRedirect,
        consumePostLoginRedirect,
        detectPlatform,
        startValueTicker,
        getPricing,
        startDownload,
        createPayment: (plan, quantity) => apiRequest('/payments', {
            method: 'POST',
            auth: true,
            body: { plan, quantity },
        }),
        getOrder: (id) => apiRequest(`/orders/${encodeURIComponent(id)}`, {
            auth: true,
        }),
        resendLicenseEmail: (id) => apiRequest(`/licenses/${encodeURIComponent(id)}/send-email`, {
            method: 'POST',
            auth: true,
        }),
        logout,
        register: (email, password) => apiRequest('/auth/register', {
            method: 'POST',
            body: { email, password },
        }),
        login: (email, password) => apiRequest('/auth/login', {
            method: 'POST',
            body: { email, password },
        }),
        verifyEmail: (token) => apiRequest('/auth/email/verify', {
            method: 'POST',
            body: { token },
        }),
        resendVerification: (email) => apiRequest('/auth/email/resend-verification', {
            method: 'POST',
            body: { email },
        }),
        requestPasswordReset: (email) => apiRequest('/auth/password-reset/request', {
            method: 'POST',
            body: { email },
        }),
        confirmPasswordReset: (token, password) => apiRequest('/auth/password-reset/confirm', {
            method: 'POST',
            body: { token, password },
        }),
    };
})();
