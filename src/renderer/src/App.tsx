import type { JSX } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import DetailsPage from './pages/DetailsPage'
import ListingPage from './pages/ListingPage'

export default function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ListingPage />} />
        <Route path="/home" element={<ListingPage />} />
        <Route path="/dir/:directoryId" element={<ListingPage />} />
        <Route path="/folder/:id" element={<DetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
