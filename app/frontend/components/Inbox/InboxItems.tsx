import React, { useState, useEffect } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { fetchInboxItems, processInboxItem, deleteInboxItem, updateInboxItem } from '../../utils/inboxService';
import InboxItemDetail from './InboxItemDetail';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { InboxIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';

const InboxItems: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { showSuccessToast, showErrorToast } = useToast();
  
  useEffect(() => {
    loadInboxItems();
    
    // Set up a periodic refresh for the inbox items every 10 seconds
    const refreshInterval = setInterval(() => {
      loadInboxItems();
    }, 10000);
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  const loadInboxItems = async () => {
    try {
      // Don't show loading state on refreshes, only on initial load
      if (items.length === 0) {
        setLoading(true);
      }
      
      const data = await fetchInboxItems();
      
      // Check if there are any new items that weren't in the previous list
      const previousIds = new Set(items.map(item => item.id));
      const newItems = data.filter(item => item.id && !previousIds.has(item.id));
      
      // If there are new items from refreshes (not the initial load), show a notification
      if (items.length > 0 && newItems.length > 0) {
        // Show notification for the first new item
        if (newItems[0].source === 'telegram') {
          showSuccessToast(t('inbox.newTelegramItem', 'New item from Telegram: {{content}}', { 
            content: newItems[0].content.substring(0, 30) + (newItems[0].content.length > 30 ? '...' : '')
          }));
        } else {
          showSuccessToast(t('inbox.newItem', 'New inbox item added: {{content}}', { 
            content: newItems[0].content.substring(0, 30) + (newItems[0].content.length > 30 ? '...' : '')
          }));
        }
        
        // If more than one new item, show a summary notification
        if (newItems.length > 1) {
          showSuccessToast(t('inbox.multipleNewItems', '{{count}} more new items added', { count: newItems.length - 1 }));
        }
      }
      
      setItems(data);
    } catch (error) {
      console.error('Failed to load inbox items:', error);
      if (items.length === 0) {
        showErrorToast(t('inbox.loadError'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleProcessItem = async (id: number) => {
    try {
      await processInboxItem(id);
      showSuccessToast(t('inbox.itemProcessed'));
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to process inbox item:', error);
      showErrorToast(t('inbox.processError'));
    }
  };
  
  const handleUpdateItem = async (id: number, content: string): Promise<void> => {
    try {
      await updateInboxItem(id, content);
      setItems(items.map(item => item.id === id ? { ...item, content } : item));
    } catch (error) {
      console.error('Failed to update inbox item:', error);
      showErrorToast(t('inbox.updateError'));
      throw error;
    }
  };
  
  const handleDeleteItem = async (id: number) => {
    try {
      await deleteInboxItem(id);
      showSuccessToast(t('inbox.itemDeleted'));
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete inbox item:', error);
      showErrorToast(t('inbox.deleteError'));
    }
  };
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center text-gray-600 dark:text-gray-300">
        <InboxIcon className="h-16 w-16" />
        <h3 className="text-xl font-semibold">{t('inbox.empty')}</h3>
        <p>{t('inbox.emptyDescription')}</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <InboxIcon className="h-6 w-6 mr-2" />
        <h1 className="text-2xl font-bold">{t('inbox.title')}</h1>
      </div>
      
      <div className="space-y-4">
        {items.map((item) => (
          <InboxItemDetail 
            key={item.id} 
            item={item} 
            onProcess={handleProcessItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
          />
        ))}
      </div>
    </div>
  );
};

export default InboxItems;