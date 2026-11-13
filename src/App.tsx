/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ProjectsCatalogView } from './components/ProjectsCatalogView';
import { ProjectsUpdateView } from './components/ProjectsUpdateView';
import { AdminAuditLogsView } from './components/AdminAuditLogsView';
import { SadiFooter } from './components/SadiFooter';
import { UserAuthModal } from './components/UserAuthModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ProjectModal } from './components/ProjectModal';
import { SharePublicModal } from './components/SharePublicModal';
import { Project, FundingSource, ProjectStatus, Quarter } from './types';

const MainAppContent: React.FC = () => {
  const {
    projects,
    currentUser,
    selectedFundingFilter,
    selectedQuarterFilter,
    selectedStatusFilter,
    setSelectedFundingFilter,
    setSelectedStatusFilter,
    setSelectedQuarterFilter,
    setSelectedCategoryFilter,
  } = useApp();

  // Check initial URL parameters for public share deep-links (?view=public&tab=projects&quarter=Q1)
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isPublicView = initialParams?.get('view') === 'public';
  const initialTabParam = initialParams?.get('tab');
  const hasFilterParam = Boolean(
    initialParams?.get('quarter') ||
      initialParams?.get('funding') ||
      initialParams?.get('status') ||
      initialParams?.get('category')
  );

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projects' | 'update' | 'admin'>(
    initialTabParam === 'projects'
      ? 'projects'
      : initialTabParam === 'update' && !isPublicView
      ? 'update'
      : 'dashboard'
  );
  const [isDrilldownMode, setIsDrilldownMode] = useState<boolean>(
    initialTabParam === 'projects' || hasFilterParam
  );

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const handleNavigateToProjects = (filter?: {
    funding?: FundingSource | 'all';
    status?: ProjectStatus | 'all';
    quarter?: Quarter | 'all';
    category?: string | 'all';
  }) => {
    setSelectedFundingFilter(filter?.funding ?? 'all');
    setSelectedStatusFilter(filter?.status ?? 'all');
    setSelectedQuarterFilter(filter?.quarter ?? 'all');
    setSelectedCategoryFilter(filter?.category ?? 'all');
    setIsDrilldownMode(true);
    setCurrentTab('projects');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavTabChange = (tab: 'dashboard' | 'projects' | 'update' | 'admin') => {
    if (tab === 'projects') {
      setIsDrilldownMode(false);
    }
    setCurrentTab(tab);
  };

  const handleOpenEditModal = (project: Project) => {
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setProjectToEdit(null);
    setIsProjectModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-slate-100 transition-colors selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleNavTabChange}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        isPublicView={isPublicView}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {(currentTab === 'dashboard' || (currentTab === 'admin' && currentUser.role !== 'admin')) && (
          <DashboardView
            onNavigateToProjects={handleNavigateToProjects}
            onOpenProjectDetail={(id) => setSelectedProjectId(id)}
          />
        )}

        {currentTab === 'projects' && (
          <ProjectsCatalogView
            onOpenProjectDetail={(id) => setSelectedProjectId(id)}
            onGoToUpdatePage={() => {
              if (!isPublicView) {
                setCurrentTab('update');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            onBackToDashboard={() => setCurrentTab('dashboard')}
            isDrilldownMode={isDrilldownMode}
          />
        )}

        {currentTab === 'update' && !isPublicView && (
          <ProjectsUpdateView
            onOpenProjectDetail={(id) => setSelectedProjectId(id)}
            onOpenEditModal={handleOpenEditModal}
            onOpenAddModal={handleOpenAddModal}
            onGoToCatalogPage={() => {
              setIsDrilldownMode(false);
              setCurrentTab('projects');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentTab === 'admin' && currentUser.role === 'admin' && !isPublicView && <AdminAuditLogsView />}
      </main>

      <SadiFooter />

      {/* Modals & Drawers */}
      <UserAuthModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onSelectProject={(id) => setSelectedProjectId(id)}
      />

      <SharePublicModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        defaultTab={currentTab === 'projects' ? 'projects' : 'dashboard'}
        currentQuarter={selectedQuarterFilter}
        currentFunding={selectedFundingFilter}
        currentStatus={selectedStatusFilter}
        onPreviewPublicLink={({ tab, quarter, funding, status }) => {
          setSelectedQuarterFilter(quarter);
          setSelectedFundingFilter(funding);
          setSelectedStatusFilter(status);
          setSelectedCategoryFilter('all');
          if (tab === 'projects') {
            setIsDrilldownMode(true);
          }
          setCurrentTab(tab);
        }}
      />

      <ProjectDetailDrawer
        project={selectedProject}
        onClose={() => setSelectedProjectId(null)}
        onEdit={handleOpenEditModal}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projectToEdit={projectToEdit}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
