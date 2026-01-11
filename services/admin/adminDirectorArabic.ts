
import { AdminMessage, AdminPlan, AgentRole, AdminStep, AgentStandardInput, DevelopmentReport, DevelopmentTicket, TicketPriority, TicketStatus } from '../../types';
import { executeBuilder } from './executors/builderExecutor';
import { executeFixer } from './executors/fixerExecutor';
import { executeProducer } from './executors/producerExecutor';
import { policyEngine } from './policyEngine';
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { db } from '../storageService';

const IMMUTABLE_RULES = `
*** IMMUTABLE CORE RULES FOR ADMIN_SUPERVISOR ***

1. ROLE EXPANSION:
   - You are the ADMIN_SUPERVISOR.
   - You manage Production, Agents, and SELF-DEVELOPMENT.

2. SELF-DEVELOPMENT PROTOCOL (STRICT):
   - You CANNOT execute any code modification or system change without a formal discussion phase.
   - You must first analyze the user request. If it involves changing how the system works or fixing a bug, you must generate a Development Report.

3. MANDATORY REPORT STRUCTURE:
   - GAP: Describe the problem/missing feature accurately.
   - IMPACT: Effect on production/quality.
   - PROPOSAL: A single, clear solution.
   - SCOPE: List of specific files allowed to change. 
     * PROHIBITED SCOPE: 'services/commandBus.ts', 'services/admin/adminDirectorArabic.ts', 'services/admin/policyEngine.ts', 'services/storageService.ts'.
   - RISK: Worst case scenario.
   - ROLLBACK: Undo mechanism.
   - METRIC_CURRENT: Measurable number before change.
   - METRIC_EXPECTED: Measurable number after change.
   - PRIORITY: A (Blocker), B (Efficiency), C (Quality), D (Cosmetic).

4. EXECUTION GATE:
   - Status 'PROPOSE_DEV' is required for any system change.
   - Only after User APPROVAL, you convert the Report to a Ticket and then to an Execution Plan.
   - Execution is strictly limited to the defined SCOPE.

5. KPI & MONITORING (MANDATORY):
   - FAILURE_RATE > 20% -> SUSPEND AGENT immediately.
   - AVG_TIME > 2x BASELINE -> Flag for optimization.
   - QUALITY < 60 -> Downgrade.
   - Daily Report is mandatory.

*** END OF RULES ***
`;

/**
 * AdminDirectorArabic (ADMIN_SUPERVISOR)
 * The core brain that speaks Arabic and manages the system with strict protocols.
 */
class AdminDirectorArabic {
    
    private history: AdminMessage[] = [];
    private currentPlan: AdminPlan | null = null;
    private pendingReport: DevelopmentReport | null = null;

    constructor() {
        // Start background health check loop
        setInterval(() => this.runHealthCheck(), 60000); // Every minute
    }

    // --- HEALTH CHECK & AUTO-ACTIONS ---
    private async runHealthCheck() {
        const metrics = await db.getAgentMetrics();
        let issuesFound = false;

        for (const m of metrics) {
            // Rule: FAILURE_RATE > 20% -> SUSPEND AGENT
            if (m.failureRate > 20 && m.status !== 'SUSPENDED') {
                m.status = 'SUSPENDED';
                await db.saveAgentMetric(m);
                await this.createAutoTicket(
                    `CRITICAL: Agent ${m.role} Suspended`,
                    `Failure rate hit ${m.failureRate}%. Auto-suspended to prevent damage.`,
                    TicketPriority.A
                );
                issuesFound = true;
            }
            // Rule: AVG_TIME > 50000ms (Example baseline) -> Flag Optimization
            if (m.avgExecutionTime > 50000 && m.successCount > 5) {
                 // Check if ticket already exists? (Simplified: just log for now)
                 console.warn(`[Admin] Agent ${m.role} is slow (${m.avgExecutionTime}ms).`);
            }
        }

        // Daily Report Check
        const lastReportKey = 'av_last_daily_report';
        const lastReport = localStorage.getItem(lastReportKey);
        const today = new Date().toDateString();
        
        if (lastReport !== today) {
            await this.generateDailyReport(metrics);
            localStorage.setItem(lastReportKey, today);
        }
    }

    private async createAutoTicket(title: string, gap: string, priority: TicketPriority) {
        const ticket: DevelopmentTicket = {
            gap: gap,
            impact: "Production Halted / Degraded",
            proposal: "Investigate logs and fix logic error",
            scope: [],
            risk: "Continued downtime",
            rollback: "Manual Reset",
            metric_current: "Failure Rate > 20%",
            metric_expected: "Failure Rate < 5%",
            priority: priority,
            id: `AUTO-${Date.now()}`,
            status: TicketStatus.PROPOSED,
            createdAt: new Date().toISOString(),
            owner: 'ADMIN_SUPERVISOR (AUTO)'
        };
        await db.saveTicket(ticket);
    }

    private async generateDailyReport(metrics: any[]) {
        const report = `
📊 **التقرير اليومي التلقائي**
- التاريخ: ${new Date().toLocaleDateString()}
- حالة النظام: ${metrics.some(m => m.status === 'SUSPENDED') ? '🔴 خطر' : '🟢 مستقر'}

**أداء الوكلاء:**
${metrics.map(m => `- ${m.role}: ${m.successCount} نجاح | ${m.failureRate}% فشل`).join('\n')}

**أهم قرار مطلوب:**
${metrics.some(m => m.failureRate > 10) ? "مراجعة الوكلاء المتعثرين فوراً." : "لا توجد مشاكل حرجة."}
        `;
        
        this.history.push({
            id: `report_${Date.now()}`,
            role: 'system',
            content: report,
            timestamp: new Date().toISOString()
        });
    }

    // --- Core Interaction Loop ---

    async chat(userMessage: string): Promise<{ response: string; plan?: AdminPlan }> {
        // 1. Add to history
        this.history.push({
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        });

        // 2. Get AI Analysis (Intent & Plan)
        const analysis = await this.analyzeIntent(userMessage);

        let responseText = "";

        // 3. Handle "Ask-First" Protocol (NEEDS_INFO)
        if (analysis.status === 'NEEDS_INFO') {
            responseText = analysis.response;
        } 
        // 4. Handle Development Proposal (STRICT PROTOCOL)
        else if (analysis.status === 'PROPOSE_DEV') {
            if (analysis.devReport) {
                this.pendingReport = analysis.devReport;
                responseText = `⚠️ **تقرير تطوير مقترح (إلزامي للموافقة)**\n\n` +
                    `**GAP:** ${this.pendingReport.gap}\n` +
                    `**IMPACT:** ${this.pendingReport.impact}\n` +
                    `**PROPOSAL:** ${this.pendingReport.proposal}\n` +
                    `**SCOPE:** [${this.pendingReport.scope.join(', ')}]\n` +
                    `**RISK:** ${this.pendingReport.risk}\n` +
                    `**PRIORITY:** ${this.pendingReport.priority}\n\n` +
                    `*${analysis.response}*\n\n` +
                    `هل توافق على تحويل هذا التقرير إلى تذكرة تنفيذ (Ticket)؟ (نعم/لا)`;
            } else {
                responseText = "خطأ: الموديل اقترح تطوير لكنه لم يرسل التقرير.";
            }
        }
        // 5. Handle Plan Proposal (Operational)
        else if (analysis.status === 'PROPOSE_PLAN') {
            this.currentPlan = {
                id: `plan_${Date.now()}`,
                title: analysis.planTitle || "New Plan",
                status: 'PROPOSED',
                steps: analysis.steps || [],
                executor: analysis.suggestedExecutor as AgentRole
            };
            responseText = `${analysis.response}\n\nلقد قمت بإعداد خطة تشغيلية. هل أبدأ التنفيذ؟`;
        }
        // 6. Handle Execution Confirmation
        else if (analysis.status === 'EXECUTE') {
            // Check if we are approving a Dev Report or an Operational Plan
            if (this.pendingReport) {
                responseText = "تم اعتماد التذكرة. جاري تحويلها إلى خطة تنفيذ...";
                await this.createTicketAndPlan();
                this.executePlan(); // Auto-start after ticket creation
            } else if (this.currentPlan) {
                responseText = "جاري التنفيذ...";
                this.executePlan();
            } else {
                responseText = "لا توجد خطة أو تذكرة معلقة للتنفيذ.";
            }
        }
        // 7. General Chat
        else {
            responseText = analysis.response;
            // Clear pending if user changed topic
            if (analysis.status === 'CHAT') this.pendingReport = null;
        }

        const botMsg: AdminMessage = {
            id: (Date.now() + 1).toString(),
            role: 'admin',
            content: responseText,
            timestamp: new Date().toISOString(),
            relatedPlanId: this.currentPlan?.id
        };
        this.history.push(botMsg);

        return { response: responseText, plan: this.currentPlan || undefined };
    }

    private async createTicketAndPlan() {
        if (!this.pendingReport) return;

        // 1. Create Ticket
        const ticket: DevelopmentTicket = {
            ...this.pendingReport,
            id: `TICKET-${Date.now()}`,
            status: TicketStatus.APPROVED,
            createdAt: new Date().toISOString(),
            owner: 'ADMIN_SUPERVISOR'
        };
        await db.saveTicket(ticket);

        // 2. Convert to Plan (Using BuilderExecutor)
        this.currentPlan = {
            id: `dev_plan_${ticket.id}`,
            title: `Execute Ticket: ${ticket.id}`,
            status: 'PROPOSED',
            executor: AgentRole.BUILDER_EXECUTOR,
            ticketId: ticket.id,
            steps: [
                {
                    id: 'step_1',
                    description: `Apply changes for: ${ticket.proposal}`,
                    command: JSON.stringify({
                        scope: ticket.scope,
                        instruction: ticket.proposal
                    }),
                    status: 'PENDING',
                    logs: []
                },
                {
                    id: 'step_2',
                    description: 'Run Verification Tests',
                    command: 'npm test', // Conceptual
                    status: 'PENDING',
                    logs: []
                }
            ]
        };
        
        // Clear pending report
        this.pendingReport = null;
    }

    // --- Execution Engine ---

    async executePlan() {
        if (!this.currentPlan) return;
        this.currentPlan.status = 'EXECUTING';

        // Check Policy
        const permission = policyEngine.checkPermission(this.currentPlan.executor, 'EXECUTE_PLAN');
        if (!permission.allowed) {
            this.currentPlan.status = 'FAILED';
            return;
        }

        try {
            for (const step of this.currentPlan.steps) {
                step.status = 'RUNNING';
                
                // Dispatch to specific Executor based on Plan type
                let result;
                // Explicitly type inputPacket to avoid inference issues with inputData
                const inputPacket: AgentStandardInput = {
                    taskId: step.id,
                    role: this.currentPlan.executor,
                    objective: step.description,
                    inputData: { command: step.command },
                    meta: { fromAdminDirector: true, timestamp: new Date().toISOString(), priority: 'Normal' }
                };

                // Add Scope context if executing a ticket
                if (this.currentPlan.ticketId && this.currentPlan.executor === AgentRole.BUILDER_EXECUTOR) {
                     // We pass the raw instruction to the Builder, but it SHOULD respect scope.
                     // In a real implementation, BuilderExecutor would enforce scope file locks.
                }

                switch (this.currentPlan.executor) {
                    case AgentRole.BUILDER_EXECUTOR:
                        result = await executeBuilder(inputPacket);
                        break;
                    case AgentRole.FIXER_EXECUTOR:
                        result = await executeFixer(inputPacket);
                        break;
                    case AgentRole.PRODUCER_EXECUTOR:
                        inputPacket.inputData.topic = step.command;
                        result = await executeProducer(inputPacket);
                        break;
                    default:
                        throw new Error("Unknown executor");
                }

                if (result.status === 'SUCCESS') {
                    step.status = 'SUCCESS';
                    step.logs = result.notes;
                } else {
                    step.status = 'FAILED';
                    step.logs = [...result.notes, ...result.warnings];
                    throw new Error("Step failed");
                }
            }
            this.currentPlan.status = 'COMPLETED';
            
            // If linked to a ticket, update ticket status
            if (this.currentPlan.ticketId) {
                const tickets = await db.getTickets();
                const ticket = tickets.find(t => t.id === this.currentPlan!.ticketId);
                if (ticket) {
                    ticket.status = TicketStatus.RELEASED;
                    await db.saveTicket(ticket);
                }
            }

        } catch (e) {
            this.currentPlan.status = 'FAILED';
        }
    }

    // --- AI Logic ---

    private async analyzeIntent(msg: string): Promise<any> {
        const providers = await db.getProviders();
        let apiKey = providers.find(p => p.providerId === 'gemini')?.apiKey;
        if (!apiKey || apiKey.trim() === '') apiKey = process.env.API_KEY;
        if (!apiKey) return { status: 'CHAT', response: "خطأ: مفتاح Gemini غير موجود." };

        const ai = new GoogleGenAI({ apiKey });
        const model = "gemini-3-pro-preview";

        const systemPrompt = `You are the Arabic Admin Director (ADMIN_SUPERVISOR) for a Video Factory.
${IMMUTABLE_RULES}

Executors:
1. BuilderExecutor: System updates, config changes, build/lint.
2. FixerExecutor: Debug logs, rollback, fix errors.
3. ProducerExecutor: Start video jobs, pipeline settings.

Input: "${msg}"

Instructions:
1. If the user asks for a feature, bug fix, or system change -> Return status "PROPOSE_DEV" and fill "devReport".
2. If the user asks to start production/fix specific operational issue -> Return "PROPOSE_PLAN".
3. If the user agrees to a pending report/plan -> Return "EXECUTE".
4. Otherwise -> "CHAT".

Output JSON:
{
  "status": "NEEDS_INFO" | "PROPOSE_PLAN" | "PROPOSE_DEV" | "EXECUTE" | "CHAT",
  "response": "Arabic text response",
  "planTitle": "Title if operational plan",
  "suggestedExecutor": "BuilderExecutor" | "FixerExecutor" | "ProducerExecutor",
  "steps": [ { "id": "1", "description": "...", "command": "..." } ],
  "devReport": {
      "gap": "...",
      "impact": "...",
      "proposal": "...",
      "scope": ["file1.ts"],
      "risk": "...",
      "rollback": "...",
      "metric_current": "...",
      "metric_expected": "...",
      "priority": "A" | "B" | "C" | "D"
  }
}
`;

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                status: { type: Type.STRING, enum: ["NEEDS_INFO", "PROPOSE_PLAN", "PROPOSE_DEV", "EXECUTE", "CHAT"] },
                response: { type: Type.STRING },
                planTitle: { type: Type.STRING },
                suggestedExecutor: { type: Type.STRING },
                steps: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: {
                            id: { type: Type.STRING },
                            description: { type: Type.STRING },
                            command: { type: Type.STRING }
                        }
                    } 
                },
                devReport: {
                    type: Type.OBJECT,
                    properties: {
                        gap: { type: Type.STRING },
                        impact: { type: Type.STRING },
                        proposal: { type: Type.STRING },
                        scope: { type: Type.ARRAY, items: { type: Type.STRING } },
                        risk: { type: Type.STRING },
                        rollback: { type: Type.STRING },
                        metric_current: { type: Type.STRING },
                        metric_expected: { type: Type.STRING },
                        priority: { type: Type.STRING, enum: ["A", "B", "C", "D"] }
                    },
                    required: ["gap", "proposal", "scope", "priority"]
                }
            },
            required: ["status", "response"]
        };

        const result = await ai.models.generateContent({
            model,
            contents: msg,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });

        return JSON.parse(result.text || "{}");
    }
}

export const adminArabic = new AdminDirectorArabic();
