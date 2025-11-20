import { BrowserRouter, Routes, Route } from "react-router-dom";
import TaskManagementHUD from "./pages/TaskManagementHUD";
import "./App.css";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TaskManagementHUD />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;