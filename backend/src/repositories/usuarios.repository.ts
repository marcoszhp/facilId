import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Chip, chipSchema } from '../schemas/payload';
export interface UsuariosRepository {listar(): Chip[]; buscar(cpf:string): Chip | undefined; salvar(chip:Chip):void;}
// Instância única por processo. Escrita síncrona e rename evitam JSON parcialmente escrito.
// Para múltiplas instâncias de servidor, substituir por banco transacional.
export class JsonUsuariosRepository implements UsuariosRepository {
  private usuarios: Chip[];
  constructor(private file:string) {
    mkdirSync(path.dirname(file),{recursive:true});
    this.usuarios = existsSync(file) ? chipSchema.array().parse(JSON.parse(readFileSync(file,'utf8'))) : [];
  }
  listar() {return structuredClone(this.usuarios);}
  buscar(cpf:string) {return this.listar().find(u=>u.cpf===cpf);}
  salvar(chip:Chip) {
    const next = [...this.usuarios.filter(u=>u.cpf!==chip.cpf),chip];
    writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});
    renameSync(this.file+'.tmp',this.file); this.usuarios=next;
  }
}
