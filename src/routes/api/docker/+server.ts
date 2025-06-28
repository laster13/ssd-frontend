import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		const { stdout: psOutput } = await execAsync(
			'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}"'
		);

		const containers = psOutput.trim().split('\n').map((line) => {
			const [id, name, image, status] = line.split('|');
			return { id, name, image, status };
		});

		const { stdout: statsOutput } = await execAsync(
			'docker stats --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}"'
		);

		const statsMap: Record<string, { cpu: string; mem: string; memPerc: string }> = {};

		statsOutput.trim().split('\n').forEach((line) => {
			const [id, cpu, memRaw] = line.split('|');
			const [mem, memTotal] = memRaw.split(' / ');
			statsMap[id] = { cpu, mem, memPerc: `${mem} / ${memTotal}` };
		});

		const enrichedContainers = containers.map((c) => {
			const stats = statsMap[c.id] ?? { cpu: '—', mem: '—', memPerc: '—' };
			return { ...c, ...stats };
		});

		return json({ containers: enrichedContainers });
	} catch (err) {
		console.error('Erreur Docker:', err);
		return json({ error: 'Erreur lors de la récupération des conteneurs.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { id, action } = await request.json();

		if (!id || !['start', 'stop', 'restart'].includes(action)) {
			return json({ error: 'Paramètres invalides' }, { status: 400 });
		}

		await execAsync(`docker ${action} ${id}`);
		return json({ success: true });
	} catch (err) {
		console.error('Erreur Docker (action):', err);
		return json({ error: 'Action Docker échouée.' }, { status: 500 });
	}
};