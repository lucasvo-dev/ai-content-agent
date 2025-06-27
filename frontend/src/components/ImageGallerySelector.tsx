import React, { useState, useEffect } from "react";
import {
  photoGalleryApi,
  PhotoGalleryCategory,
  PhotoGalleryImage,
  PhotoGalleryFolder,
} from "../services/photoGalleryApi";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Label } from "./ui/Label";
import { Select } from "./ui/Select";

interface ImageGallerySelectorProps {
  onImagesSelected: (images: PhotoGalleryImage[]) => void;
  maxImages?: number;
  contentTopic?: string;
  imageSelection: 'auto-category' | 'specific-folder' | 'manual';
  imageCategory?: string;
  specificFolder?: string;
}

export const ImageGallerySelector: React.FC<ImageGallerySelectorProps> = ({
  onImagesSelected,
  maxImages = 3,
  contentTopic = "",
  imageSelection,
  imageCategory,
  specificFolder,
}) => {
  const [categories, setCategories] = useState<PhotoGalleryCategory[]>([]);
  const [folders, setFolders] = useState<PhotoGalleryFolder[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(imageCategory || "");
  const [selectedFolder, setSelectedFolder] = useState<string>(specificFolder || "");
  const [availableImages, setAvailableImages] = useState<PhotoGalleryImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<PhotoGalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (imageSelection !== 'manual') {
      loadCategories();
    }
  }, [imageSelection]);

  useEffect(() => {
    if (selectedCategory && imageSelection === 'specific-folder') {
      loadFolders(selectedCategory);
    }
  }, [selectedCategory, imageSelection]);

  useEffect(() => {
    if (imageSelection === 'auto-category' && imageCategory) {
      setSelectedCategory(imageCategory);
      loadImages(imageCategory);
    } else if (imageSelection === 'specific-folder' && specificFolder) {
      setSelectedFolder(specificFolder);
      loadImagesByFolder(specificFolder);
    }
  }, [imageSelection, imageCategory, specificFolder]);

  useEffect(() => {
    if (contentTopic && imageSelection === 'auto-category' && !imageCategory) {
      autoSelectCategory();
    }
  }, [contentTopic, categories, imageSelection, imageCategory]);

  const loadCategories = async () => {
    try {
      const cats = await photoGalleryApi.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categories:", error);
      setError("Failed to load image categories");
    }
  };

  const loadFolders = async (categorySlug: string) => {
    setLoadingFolders(true);
    setError("");
    try {
      const folderList = await photoGalleryApi.getFoldersByCategory(categorySlug);
      setFolders(folderList);
    } catch (error) {
      console.error("Failed to load folders:", error);
      setError("Failed to load folders");
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadImages = async (categorySlug: string) => {
    setLoading(true);
    setError("");
    try {
      const images = await photoGalleryApi.getFeaturedImages({
        categorySlug,
        limit: 10,
        format: "wordpress",
        consistentFolder: true,
      });
      setAvailableImages(images);
      
      // Auto-select first N images
      if (images.length > 0) {
        const autoSelected = images.slice(0, maxImages);
        setSelectedImages(autoSelected);
        onImagesSelected(autoSelected);
      }
    } catch (error) {
      console.error("Failed to load images:", error);
      setError("Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  const loadImagesByFolder = async (folderName: string) => {
    setLoading(true);
    setError("");
    try {
      const images = await photoGalleryApi.getFeaturedImages({
        folderName,
        limit: 10,
        format: "wordpress",
      });
      setAvailableImages(images);
      
      // Auto-select first N images
      if (images.length > 0) {
        const autoSelected = images.slice(0, maxImages);
        setSelectedImages(autoSelected);
        onImagesSelected(autoSelected);
      }
    } catch (error) {
      console.error("Failed to load images:", error);
      setError("Failed to load images from folder");
    } finally {
      setLoading(false);
    }
  };

  const autoSelectCategory = () => {
    if (!contentTopic || categories.length === 0) return;

    const topic = contentTopic.toLowerCase();
    let matchedCategory = "";

    if (
      topic.includes("cưới") ||
      topic.includes("wedding") ||
      topic.includes("đám cưới")
    ) {
      matchedCategory = "wedding";
    } else if (topic.includes("pre-wedding") || topic.includes("prewedding")) {
      matchedCategory = "pre-wedding";
    } else if (topic.includes("kỷ yếu") && topic.includes("trường")) {
      matchedCategory = "graduation-school";
    } else if (topic.includes("kỷ yếu") && topic.includes("concept")) {
      matchedCategory = "graduation-concept";
    } else if (topic.includes("doanh nghiệp") || topic.includes("corporate")) {
      matchedCategory = "corporate";
    } else if (topic.includes("ảnh thẻ") || topic.includes("profile")) {
      matchedCategory = "id-photo";
    }

    if (
      matchedCategory &&
      categories.find((c) => c.category_slug === matchedCategory)
    ) {
      setSelectedCategory(matchedCategory);
      loadImages(matchedCategory);
    }
  };

  const toggleImageSelection = (image: PhotoGalleryImage) => {
    const isSelected = selectedImages.find((img) => img.id === image.id);

    if (isSelected) {
      const newSelection = selectedImages.filter((img) => img.id !== image.id);
      setSelectedImages(newSelection);
      onImagesSelected(newSelection);
    } else if (selectedImages.length < maxImages) {
      const newSelection = [...selectedImages, image];
      setSelectedImages(newSelection);
      onImagesSelected(newSelection);
    }
  };

  if (imageSelection === 'manual') {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📸 Manual Image Selection</h3>
        <p className="text-gray-600">
          Images will be selected manually after content generation.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">📸 Photo Gallery Selection</h3>
          <span className="text-sm text-gray-600">
            Selected: {selectedImages.length}/{maxImages} images
          </span>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Category/Folder Selection */}
        {imageSelection === 'specific-folder' && (
          <>
            <div>
              <Label htmlFor="category">Select Category</Label>
              <Select
                id="category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedFolder("");
                }}
                className="w-full"
              >
                <option value="">Choose a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.category_slug}>
                    {cat.category_name} ({cat.folder_count} folders)
                  </option>
                ))}
              </Select>
            </div>

            {selectedCategory && (
              <div>
                <Label htmlFor="folder">Select Folder</Label>
                <Select
                  id="folder"
                  value={selectedFolder}
                  onChange={(e) => {
                    setSelectedFolder(e.target.value);
                    if (e.target.value) {
                      loadImagesByFolder(e.target.value);
                    }
                  }}
                  className="w-full"
                  disabled={loadingFolders}
                >
                  <option value="">
                    {loadingFolders ? "Loading folders..." : "Choose a folder..."}
                  </option>
                  {folders.map((folder) => (
                    <option key={folder.folder_name} value={folder.folder_name}>
                      {folder.folder_name} ({folder.featured_count} featured)
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </>
        )}

        {imageSelection === 'auto-category' && (
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm text-blue-800">
              {selectedCategory ? (
                <>
                  <strong>Auto-detected category:</strong> {
                    categories.find(c => c.category_slug === selectedCategory)?.category_name
                  }
                </>
              ) : (
                "Detecting category from content topic..."
              )}
            </p>
          </div>
        )}

        {/* Images Grid */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading images...</p>
          </div>
        ) : availableImages.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click images to select/deselect (max {maxImages} images)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {availableImages.map((image) => {
                const isSelected = selectedImages.find((img) => img.id === image.id);
                const canSelect = selectedImages.length < maxImages;

                return (
                  <div
                    key={image.id}
                    className={`
                      relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all
                      ${isSelected
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : canSelect
                        ? "border-gray-200 hover:border-blue-300"
                        : "border-gray-200 opacity-50 cursor-not-allowed"
                      }
                    `}
                    onClick={() =>
                      (isSelected || canSelect) && toggleImageSelection(image)
                    }
                  >
                    <img
                      src={image.thumbnail_url}
                      alt={image.alt_text}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-2 bg-white">
                      <p
                        className="text-xs text-gray-600 truncate"
                        title={image.alt_text}
                      >
                        {image.alt_text}
                      </p>
                      {isSelected && (
                        <div className="mt-1">
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            ✓ Selected
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {selectedCategory || selectedFolder
              ? "No featured images found"
              : "Select a category or folder to view images"}
          </div>
        )}

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Selected Images:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.thumbnail_url}
                    alt={image.alt_text}
                    className="w-20 h-20 object-cover rounded border-2 border-blue-300"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleImageSelection(image);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}; 