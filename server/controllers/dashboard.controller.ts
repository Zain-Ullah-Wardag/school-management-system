import { asyncHandler,success } from '../utils/http';
import { DashboardService } from '../services/dashboard.service';
const service=new DashboardService();export const overview=asyncHandler((_req,res)=>success(res,service.overview()));
