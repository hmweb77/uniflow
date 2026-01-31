// src/app/hooks/useImageUpload.js
// Custom hook for uploading images via server-side API

import { useState } from 'react';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  /**
   * Upload an image file to Firebase Storage via server API
   * @param {File} file - The file to upload
   * @param {string} path - The storage path (e.g., 'events/banner')
   * @returns {Promise<{url: string, filename: string}>}
   */
  const uploadImage = async (file, path = 'uploads') => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Validate file on client side first
      if (!file) {
        throw new Error('No file provided');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type: ${file.type}. Please use JPEG, PNG, GIF, or WebP.`);
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File is too large. Maximum size is 5MB.');
      }

      setProgress(10);

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      setProgress(30);

      // Upload via API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setProgress(100);

      return {
        url: result.url,
        filename: result.filename,
      };

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload image');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  /**
   * Upload from a data URL (base64)
   * @param {string} dataUrl - The base64 data URL
   * @param {string} filename - The filename to use
   * @param {string} path - The storage path
   */
  const uploadFromDataUrl = async (dataUrl, filename, path = 'uploads') => {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type });
    return uploadImage(file, path);
  };

  return {
    uploadImage,
    uploadFromDataUrl,
    uploading,
    error,
    progress,
    clearError: () => setError(null),
  };
}

export default useImageUpload;