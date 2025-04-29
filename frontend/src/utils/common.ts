/**
 * Decode a Base64-encoded string into a Blob.
 * @param base64Data - The Base64-encoded string.
 * @param mimeType - The MIME type of the resulting Blob (optional).
 * @returns A Blob object or null if decoding fails.
 */
export const decodeBase64 = (base64Data: string, mimeType: string = ''): Blob | null => {
  try {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('Failed to decode Base64 data:', error);
    return null;
  }
};

/**
 * 获取云服务后台地址，根据环境区分调试和生产环境。
 * @returns 后台服务的基础 URL。
 */
const getCloudBackendUrl = (): string => {
  const isDebug = process.env.NODE_ENV === 'development';
  const isAndroid = getEnvironment() === 'Android';
  const baseUrl = isAndroid ? 'http://10.0.2.2:8101' : (process.env.NEXT_CLOUD_BACKEND_URL || 'http://localhost:8101');
  const cloudBackendUrl = baseUrl + '/cloud';
  const productionBackendUrl = 'http://192.168.68.58:8101/cloud';
  return isDebug ? cloudBackendUrl : productionBackendUrl;
};

/**
 * 获取本机后台地址。
 * @returns 本机服务的基础 URL。
 */
const getDeviceBackendUrl = (): string => {
  const isAndroid = getEnvironment() === 'Android';
  const baseUrl = isAndroid ? 'http://10.0.2.2:8201' : (process.env.NEXT_LOCAL_BACKEND_URL || 'http://localhost:8201');
  const backendUrl = baseUrl + '/local';
  return backendUrl;
};

/**
 * 获取当前浏览器环境。
 * @returns 当前浏览器环境的字符串描述。
 */
export const getEnvironment = () => {
  const userAgent = navigator.userAgent || navigator.vendor;

  if (/windows phone/i.test(userAgent)) {
    return 'Windows Phone';
  }
  if (/android/i.test(userAgent)) {
    return 'Android';
  }
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return 'iOS';
  }
  if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(userAgent)) {
    return 'Mac';
  }
  if (/Win32|Win64|Windows|WinCE/.test(userAgent)) {
    return 'Windows';
  }
  return 'Unknown';
};

export const getFileUrl = (file_id: string, file_type: FileType) => {
  if (file_type === FileType.SCORE) {
    return `${getCloudBackendUrl()}/get-score-file-by-id/${file_id}`;
  } else if (file_type === FileType.AUDIO) {
    return `${getCloudBackendUrl()}/get-audio-file-by-id/${file_id}`;
  } else if (file_type === FileType.MIDI) {
    return `${getCloudBackendUrl()}/get-midi-file-by-id/${file_id}`;
  }
  return '';
};

export enum FileType {
  SCORE = 'score',
  AUDIO = 'audio',
  MIDI = 'midi',
}


export const BE_Url_Cloud = getCloudBackendUrl();
export const BE_Url_Local = getDeviceBackendUrl();
